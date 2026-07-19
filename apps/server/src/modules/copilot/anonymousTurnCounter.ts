import { createHash, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import type { AnonymousTurnUsage } from "@visepanda/domain";

export const DEFAULT_ANONYMOUS_TURN_LIMIT = 3;
export const ANONYMOUS_TURN_TTL_SECONDS = 60 * 60 * 24 * 30;
const RESERVATION_TTL_MILLISECONDS = 2 * 60 * 1_000;

type Environment = Readonly<Record<string, string | undefined>>;

export type AnonymousTurnReservation = {
  allowed: true;
  complete(): Promise<AnonymousTurnUsage>;
  release(): Promise<void>;
};

export type AnonymousTurnAdmission =
  | AnonymousTurnReservation
  | {
      allowed: false;
      reason: "capacity_reserved" | "limit_reached";
      usage: AnonymousTurnUsage;
    };

export type AnonymousTurnCounter = {
  reserve(anonId: string): Promise<AnonymousTurnAdmission>;
};

export type UpstashAnonymousTurnCounterConfig = {
  url: string;
  token: string;
  limit: number;
  ttlSeconds: number;
};

type RedisScriptClient = {
  eval(script: string, keys: string[], args: unknown[]): Promise<unknown>;
};

export class AnonymousTurnControlUnavailableError extends Error {
  readonly code = "ANONYMOUS_TURN_CONTROL_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("Anonymous Copilot turn control is unavailable.");
    this.name = "AnonymousTurnControlUnavailableError";
  }
}

export class AnonymousTurnLimitExceededError extends Error {
  readonly code = "ANONYMOUS_TURN_LIMIT_REACHED";

  constructor(readonly usage: AnonymousTurnUsage) {
    super("Sign in to continue using the Copilot.");
    this.name = "AnonymousTurnLimitExceededError";
  }
}

export class AnonymousTurnCapacityReservedError extends Error {
  readonly code = "ANONYMOUS_TURN_IN_PROGRESS";

  constructor(readonly usage: AnonymousTurnUsage) {
    super("Another anonymous Copilot question is still finishing.");
    this.name = "AnonymousTurnCapacityReservedError";
  }
}

export function resolveUpstashAnonymousTurnCounterConfig(
  environment: Environment,
): UpstashAnonymousTurnCounterConfig {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new AnonymousTurnControlUnavailableError("redis_configuration_missing");
  }

  const configuredLimit = environment.VISEPANDA_ANON_TURN_LIMIT?.trim();
  const limit = configuredLimit ? Number(configuredLimit) : DEFAULT_ANONYMOUS_TURN_LIMIT;
  if (!Number.isInteger(limit) || limit < 1) {
    throw new AnonymousTurnControlUnavailableError("turn_limit_invalid");
  }

  return { url, token, limit, ttlSeconds: ANONYMOUS_TURN_TTL_SECONDS };
}

export function createUpstashAnonymousTurnCounter(
  config: UpstashAnonymousTurnCounterConfig,
  client: RedisScriptClient = new Redis({
    url: config.url,
    token: config.token,
    enableTelemetry: false,
    signal: () => AbortSignal.timeout(1_500),
  }),
): AnonymousTurnCounter {
  return createScriptedAnonymousTurnCounter(client, config);
}

export function createInMemoryAnonymousTurnCounter({
  limit = DEFAULT_ANONYMOUS_TURN_LIMIT,
  ttlSeconds = ANONYMOUS_TURN_TTL_SECONDS,
  now = () => Date.now(),
}: {
  limit?: number;
  ttlSeconds?: number;
  now?: () => number;
} = {}): AnonymousTurnCounter {
  type Entry = { completed: number; expiresAt: number; leases: Map<string, number> };
  const entries = new Map<string, Entry>();

  return {
    async reserve(anonId) {
      const currentTime = now();
      let entry = entries.get(anonId);
      if (!entry || entry.expiresAt <= currentTime) {
        entry = {
          completed: 0,
          expiresAt: currentTime + ttlSeconds * 1_000,
          leases: new Map(),
        };
        entries.set(anonId, entry);
      }
      for (const [leaseId, createdAt] of entry.leases) {
        if (createdAt <= currentTime - RESERVATION_TTL_MILLISECONDS) entry.leases.delete(leaseId);
      }
      entry.expiresAt = currentTime + ttlSeconds * 1_000;
      if (entry.completed >= limit) {
        return { allowed: false, reason: "limit_reached", usage: usage(entry.completed, limit) };
      }
      if (entry.completed + entry.leases.size >= limit) {
        return {
          allowed: false,
          reason: "capacity_reserved",
          usage: usage(entry.completed, limit),
        };
      }

      const leaseId = randomUUID();
      entry.leases.set(leaseId, currentTime);
      let settled = false;
      return {
        allowed: true,
        async complete() {
          if (!settled && entry!.leases.delete(leaseId)) entry!.completed += 1;
          settled = true;
          entry!.expiresAt = now() + ttlSeconds * 1_000;
          return usage(entry!.completed, limit);
        },
        async release() {
          if (!settled) entry!.leases.delete(leaseId);
          settled = true;
        },
      };
    },
  };
}

function createScriptedAnonymousTurnCounter(
  client: RedisScriptClient,
  config: UpstashAnonymousTurnCounterConfig,
): AnonymousTurnCounter {
  return {
    async reserve(anonId) {
      const leaseId = randomUUID();
      const now = Date.now();
      const key = `vp:copilot:anon-turns:${digest(anonId)}`;
      let result: unknown;
      try {
        result = await client.eval(
          RESERVE_SCRIPT,
          [key],
          [leaseId, config.limit, config.ttlSeconds, now - RESERVATION_TTL_MILLISECONDS, now],
        );
      } catch {
        throw new AnonymousTurnControlUnavailableError("redis_request_failed");
      }
      const parsed = parseIntegerTuple(result, 3);
      const admissionStatus = parsed[0]!;
      const completed = parsed[1]!;
      if (![0, 1, 2].includes(admissionStatus)) {
        throw new AnonymousTurnControlUnavailableError("redis_response_invalid");
      }
      if (admissionStatus !== 1) {
        return {
          allowed: false,
          reason: admissionStatus === 2 ? "capacity_reserved" : "limit_reached",
          usage: usage(completed, config.limit),
        };
      }

      let settled = false;
      return {
        allowed: true,
        async complete() {
          if (settled) return readUsage(client, key, config);
          const value = await evalCompletionWithRetry(client, key, leaseId, config.ttlSeconds);
          settled = true;
          return usage(parseInteger(value), config.limit);
        },
        async release() {
          if (settled) return;
          try {
            await client.eval(RELEASE_SCRIPT, [key], [leaseId, config.ttlSeconds]);
            settled = true;
          } catch {
            throw new AnonymousTurnControlUnavailableError("redis_request_failed");
          }
        },
      };
    },
  };
}

async function evalCompletionWithRetry(
  client: RedisScriptClient,
  key: string,
  leaseId: string,
  ttlSeconds: number,
): Promise<unknown> {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await client.eval(COMPLETE_SCRIPT, [key], [leaseId, ttlSeconds]);
    } catch {
      if (attempt === 2) {
        throw new AnonymousTurnControlUnavailableError("redis_request_failed");
      }
    }
  }
  throw new AnonymousTurnControlUnavailableError("redis_request_failed");
}

async function readUsage(
  client: RedisScriptClient,
  key: string,
  config: UpstashAnonymousTurnCounterConfig,
): Promise<AnonymousTurnUsage> {
  try {
    const completed = await client.eval(READ_SCRIPT, [key], []);
    return usage(parseInteger(completed), config.limit);
  } catch {
    throw new AnonymousTurnControlUnavailableError("redis_request_failed");
  }
}

function usage(completedTurns: number, limit: number): AnonymousTurnUsage {
  return { completedTurns, limit, remaining: Math.max(0, limit - completedTurns) };
}

function parseIntegerTuple(value: unknown, minimumLength: number): number[] {
  if (!Array.isArray(value) || value.length < minimumLength) {
    throw new AnonymousTurnControlUnavailableError("redis_response_invalid");
  }
  return value.map(parseInteger);
}

function parseInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AnonymousTurnControlUnavailableError("redis_response_invalid");
  }
  return parsed;
}

function digest(anonId: string): string {
  return createHash("sha256").update(anonId).digest("hex");
}

const RESERVE_SCRIPT = `
local key = KEYS[1]
local leaseField = "lease:" .. ARGV[1]
local limit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
local staleBefore = tonumber(ARGV[4])
local now = ARGV[5]
local entries = redis.call("HGETALL", key)
local completed = tonumber(redis.call("HGET", key, "completed") or "0")
local pending = 0

for index = 1, #entries, 2 do
  local field = entries[index]
  if string.sub(field, 1, 6) == "lease:" then
    local createdAt = tonumber(entries[index + 1]) or 0
    if createdAt <= staleBefore then
      redis.call("HDEL", key, field)
    else
      pending = pending + 1
    end
  end
end

if completed >= limit then
  redis.call("EXPIRE", key, ttl)
  return {0, completed, pending}
end

if completed + pending >= limit then
  redis.call("EXPIRE", key, ttl)
  return {2, completed, pending}
end

redis.call("HSET", key, leaseField, now)
redis.call("EXPIRE", key, ttl)
return {1, completed, pending + 1}
`;

const COMPLETE_SCRIPT = `
local key = KEYS[1]
local leaseField = "lease:" .. ARGV[1]
local completionField = "done:" .. ARGV[1]
local ttl = tonumber(ARGV[2])
local completed = tonumber(redis.call("HGET", key, "completed") or "0")

local priorCompletion = redis.call("HGET", key, completionField)
if priorCompletion then
  redis.call("EXPIRE", key, ttl)
  return tonumber(priorCompletion)
end

if redis.call("HDEL", key, leaseField) == 1 then
  completed = redis.call("HINCRBY", key, "completed", 1)
end
redis.call("HSET", key, completionField, completed)
redis.call("EXPIRE", key, ttl)
return completed
`;

const RELEASE_SCRIPT = `
local key = KEYS[1]
local leaseField = "lease:" .. ARGV[1]
local ttl = tonumber(ARGV[2])
redis.call("HDEL", key, leaseField)
if redis.call("EXISTS", key) == 1 then
  redis.call("EXPIRE", key, ttl)
end
return 1
`;

const READ_SCRIPT = `
return tonumber(redis.call("HGET", KEYS[1], "completed") or "0")
`;
