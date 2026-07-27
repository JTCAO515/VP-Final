import { createHmac, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

export const DEFAULT_TELEMETRY_IDENTITY_MINUTE_LIMIT = 60;
export const DEFAULT_TELEMETRY_IDENTITY_HOUR_LIMIT = 300;
export const DEFAULT_TELEMETRY_IP_MINUTE_LIMIT = 180;
export const DEFAULT_TELEMETRY_IP_HOUR_LIMIT = 900;
export const TELEMETRY_RATE_LIMIT_TTL_SECONDS = 60 * 60;

type Environment = Readonly<Record<string, string | undefined>>;

export type TelemetryRateLimitAdmission =
  | {
      allowed: true;
      identityMinuteRemaining: number;
      identityHourRemaining: number;
      ipMinuteRemaining: number;
      ipHourRemaining: number;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
      rejectionCount: number;
      identityMinuteRemaining: number;
      identityHourRemaining: number;
      ipMinuteRemaining: number;
      ipHourRemaining: number;
    };

export type TelemetryRateLimiter = {
  check(input: { subject: string; clientAddress: string }): Promise<TelemetryRateLimitAdmission>;
};

export type UpstashTelemetryRateLimiterConfig = {
  url: string;
  token: string;
  hashSalt: string;
  identityMinuteLimit: number;
  identityHourLimit: number;
  ipMinuteLimit: number;
  ipHourLimit: number;
  ttlSeconds: number;
};

type RedisScriptClient = {
  eval(script: string, keys: string[], args: unknown[]): Promise<unknown>;
};

export class TelemetryRateLimitUnavailableError extends Error {
  readonly code = "TELEMETRY_RATE_LIMIT_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("Telemetry rate limiting is unavailable.");
    this.name = "TelemetryRateLimitUnavailableError";
  }
}

export function resolveUpstashTelemetryRateLimiterConfig(
  environment: Environment,
): UpstashTelemetryRateLimiterConfig {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new TelemetryRateLimitUnavailableError("redis_configuration_missing");

  const hashSalt = environment.VISEPANDA_IP_HASH_SALT?.trim();
  if (!hashSalt || hashSalt.length < 32) {
    throw new TelemetryRateLimitUnavailableError("hash_salt_missing");
  }

  return {
    url,
    token,
    hashSalt,
    identityMinuteLimit: positiveInteger(
      environment.VISEPANDA_TELEMETRY_IDENTITY_RATE_LIMIT_MINUTE,
      DEFAULT_TELEMETRY_IDENTITY_MINUTE_LIMIT,
      "identity_minute_limit_invalid",
    ),
    identityHourLimit: positiveInteger(
      environment.VISEPANDA_TELEMETRY_IDENTITY_RATE_LIMIT_HOUR,
      DEFAULT_TELEMETRY_IDENTITY_HOUR_LIMIT,
      "identity_hour_limit_invalid",
    ),
    ipMinuteLimit: positiveInteger(
      environment.VISEPANDA_TELEMETRY_IP_RATE_LIMIT_MINUTE,
      DEFAULT_TELEMETRY_IP_MINUTE_LIMIT,
      "ip_minute_limit_invalid",
    ),
    ipHourLimit: positiveInteger(
      environment.VISEPANDA_TELEMETRY_IP_RATE_LIMIT_HOUR,
      DEFAULT_TELEMETRY_IP_HOUR_LIMIT,
      "ip_hour_limit_invalid",
    ),
    ttlSeconds: TELEMETRY_RATE_LIMIT_TTL_SECONDS,
  };
}

export function createUpstashTelemetryRateLimiter(
  config: UpstashTelemetryRateLimiterConfig,
  client: RedisScriptClient = new Redis({
    url: config.url,
    token: config.token,
    enableTelemetry: false,
    signal: () => AbortSignal.timeout(1_500),
  }),
): TelemetryRateLimiter {
  return {
    async check({ subject, clientAddress }) {
      const now = Date.now();
      const identityKey = `vp:telemetry:identity-rate:${digest(`identity:${subject}`, config.hashSalt)}`;
      const ipKey = `vp:telemetry:ip-rate:${digest(`ip:${clientAddress}`, config.hashSalt)}`;
      const rejectionKey = `vp:telemetry:rate-rejections:${digest(
        `rejection:ip:${clientAddress}`,
        config.hashSalt,
      )}`;
      let result: unknown;
      try {
        result = await client.eval(
          DUAL_SLIDING_WINDOW_SCRIPT,
          [identityKey, ipKey, rejectionKey],
          [
            now,
            config.identityMinuteLimit,
            config.identityHourLimit,
            config.ipMinuteLimit,
            config.ipHourLimit,
            config.ttlSeconds,
            `${now}:${randomUUID()}`,
            `${now}:${randomUUID()}`,
          ],
        );
      } catch {
        throw new TelemetryRateLimitUnavailableError("redis_request_failed");
      }
      return parseAdmission(result);
    },
  };
}

export function createInMemoryTelemetryRateLimiter({
  identityMinuteLimit = DEFAULT_TELEMETRY_IDENTITY_MINUTE_LIMIT,
  identityHourLimit = DEFAULT_TELEMETRY_IDENTITY_HOUR_LIMIT,
  ipMinuteLimit = DEFAULT_TELEMETRY_IP_MINUTE_LIMIT,
  ipHourLimit = DEFAULT_TELEMETRY_IP_HOUR_LIMIT,
  ttlSeconds = TELEMETRY_RATE_LIMIT_TTL_SECONDS,
  now = () => Date.now(),
}: {
  identityMinuteLimit?: number;
  identityHourLimit?: number;
  ipMinuteLimit?: number;
  ipHourLimit?: number;
  ttlSeconds?: number;
  now?: () => number;
} = {}): TelemetryRateLimiter {
  const identityEntries = new Map<string, number[]>();
  const ipEntries = new Map<string, number[]>();
  const rejections = new Map<string, { count: number; expiresAt: number }>();

  return {
    async check({ subject, clientAddress }) {
      const currentTime = now();
      const identity = evaluateWindow(
        identityEntries,
        subject,
        identityMinuteLimit,
        identityHourLimit,
        currentTime,
      );
      const ip = evaluateWindow(ipEntries, clientAddress, ipMinuteLimit, ipHourLimit, currentTime);
      const retryAfterSeconds = Math.max(identity.retryAfterSeconds, ip.retryAfterSeconds);
      if (retryAfterSeconds > 0) {
        const rejectionKey = clientAddress;
        const previous = rejections.get(rejectionKey);
        const rejection =
          previous && previous.expiresAt > currentTime
            ? { ...previous, count: previous.count + 1 }
            : { count: 1, expiresAt: currentTime + ttlSeconds * 1_000 };
        rejections.set(rejectionKey, rejection);
        return {
          allowed: false,
          retryAfterSeconds,
          rejectionCount: rejection.count,
          identityMinuteRemaining: identity.minuteRemaining,
          identityHourRemaining: identity.hourRemaining,
          ipMinuteRemaining: ip.minuteRemaining,
          ipHourRemaining: ip.hourRemaining,
        };
      }

      identity.entries.push(currentTime);
      ip.entries.push(currentTime);
      return {
        allowed: true,
        identityMinuteRemaining: identity.minuteRemaining - 1,
        identityHourRemaining: identity.hourRemaining - 1,
        ipMinuteRemaining: ip.minuteRemaining - 1,
        ipHourRemaining: ip.hourRemaining - 1,
      };
    },
  };
}

function positiveInteger(raw: string | undefined, fallback: number, reason: string): number {
  const value = raw?.trim() ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new TelemetryRateLimitUnavailableError(reason);
  }
  return value;
}

function digest(value: string, hashSalt: string): string {
  return createHmac("sha256", hashSalt).update(value).digest("hex");
}

function evaluateWindow(
  entries: Map<string, number[]>,
  key: string,
  minuteLimit: number,
  hourLimit: number,
  currentTime: number,
) {
  const hourCutoff = currentTime - 3_600_000;
  const retained = (entries.get(key) ?? []).filter((entry) => entry > hourCutoff);
  entries.set(key, retained);
  const minuteEntries = retained.filter((entry) => entry > currentTime - 60_000);
  const minuteBlocked = minuteEntries.length >= minuteLimit;
  const hourBlocked = retained.length >= hourLimit;
  return {
    entries: retained,
    minuteRemaining: Math.max(0, minuteLimit - minuteEntries.length),
    hourRemaining: Math.max(0, hourLimit - retained.length),
    retryAfterSeconds: Math.max(
      minuteBlocked ? retryAfterSeconds(minuteEntries[0]!, 60_000, currentTime) : 0,
      hourBlocked ? retryAfterSeconds(retained[0]!, 3_600_000, currentTime) : 0,
    ),
  };
}

function retryAfterSeconds(timestamp: number, windowMilliseconds: number, now: number): number {
  return Math.max(1, Math.ceil((timestamp + windowMilliseconds - now) / 1_000));
}

function parseAdmission(value: unknown): TelemetryRateLimitAdmission {
  if (!Array.isArray(value) || value.length < 7) {
    throw new TelemetryRateLimitUnavailableError("redis_response_invalid");
  }
  const [
    status,
    retryAfter,
    identityMinuteRemaining,
    identityHourRemaining,
    ipMinuteRemaining,
    ipHourRemaining,
    rejectionCount,
  ] = value.map(parseNonNegativeInteger);
  if (status === 1 && retryAfter === 0 && rejectionCount === 0) {
    return {
      allowed: true,
      identityMinuteRemaining: identityMinuteRemaining!,
      identityHourRemaining: identityHourRemaining!,
      ipMinuteRemaining: ipMinuteRemaining!,
      ipHourRemaining: ipHourRemaining!,
    };
  }
  if (status === 0 && retryAfter! > 0 && rejectionCount! > 0) {
    return {
      allowed: false,
      retryAfterSeconds: retryAfter!,
      rejectionCount: rejectionCount!,
      identityMinuteRemaining: identityMinuteRemaining!,
      identityHourRemaining: identityHourRemaining!,
      ipMinuteRemaining: ipMinuteRemaining!,
      ipHourRemaining: ipHourRemaining!,
    };
  }
  throw new TelemetryRateLimitUnavailableError("redis_response_invalid");
}

function parseNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new TelemetryRateLimitUnavailableError("redis_response_invalid");
  }
  return parsed;
}

const DUAL_SLIDING_WINDOW_SCRIPT = `
local identityKey = KEYS[1]
local ipKey = KEYS[2]
local rejectionKey = KEYS[3]
local now = tonumber(ARGV[1])
local identityMinuteLimit = tonumber(ARGV[2])
local identityHourLimit = tonumber(ARGV[3])
local ipMinuteLimit = tonumber(ARGV[4])
local ipHourLimit = tonumber(ARGV[5])
local ttl = tonumber(ARGV[6])
local identityMember = ARGV[7]
local ipMember = ARGV[8]
local minuteWindow = 60000
local hourWindow = 3600000

local function evaluate(key, minuteLimit, hourLimit)
  local minuteCutoff = now - minuteWindow
  local hourCutoff = now - hourWindow
  redis.call("ZREMRANGEBYSCORE", key, "-inf", hourCutoff)
  local minuteCount = redis.call("ZCOUNT", key, "(" .. minuteCutoff, "+inf")
  local hourCount = redis.call("ZCARD", key)
  local retryAfter = 0

  if minuteCount >= minuteLimit then
    local earliestMinute = redis.call("ZRANGEBYSCORE", key, "(" .. minuteCutoff, "+inf", "WITHSCORES", "LIMIT", 0, 1)
    if #earliestMinute >= 2 then
      retryAfter = math.max(retryAfter, math.ceil((tonumber(earliestMinute[2]) + minuteWindow - now) / 1000))
    end
  end

  if hourCount >= hourLimit then
    local earliestHour = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
    if #earliestHour >= 2 then
      retryAfter = math.max(retryAfter, math.ceil((tonumber(earliestHour[2]) + hourWindow - now) / 1000))
    end
  end

  return retryAfter, math.max(0, minuteLimit - minuteCount), math.max(0, hourLimit - hourCount)
end

local identityRetry, identityMinuteRemaining, identityHourRemaining = evaluate(identityKey, identityMinuteLimit, identityHourLimit)
local ipRetry, ipMinuteRemaining, ipHourRemaining = evaluate(ipKey, ipMinuteLimit, ipHourLimit)
local retryAfter = math.max(identityRetry, ipRetry)

if retryAfter > 0 then
  redis.call("EXPIRE", identityKey, ttl)
  redis.call("EXPIRE", ipKey, ttl)
  local rejectionCount = redis.call("INCR", rejectionKey)
  if rejectionCount == 1 then redis.call("EXPIRE", rejectionKey, ttl) end
  return {0, retryAfter, identityMinuteRemaining, identityHourRemaining, ipMinuteRemaining, ipHourRemaining, rejectionCount}
end

redis.call("ZADD", identityKey, now, identityMember)
redis.call("EXPIRE", identityKey, ttl)
redis.call("ZADD", ipKey, now, ipMember)
redis.call("EXPIRE", ipKey, ttl)
return {1, 0, identityMinuteRemaining - 1, identityHourRemaining - 1, ipMinuteRemaining - 1, ipHourRemaining - 1, 0}
`;
