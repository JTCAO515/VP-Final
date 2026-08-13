import { createHmac, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";
import { resolvePublicRuntimePolicy } from "../runtimeSafety/publicRuntimePolicy.js";

export const AUTHENTICATED_COPILOT_RATE_LIMIT_TTL_SECONDS = 60 * 60;

type Environment = Readonly<Record<string, string | undefined>>;

export type AuthenticatedCopilotRateLimitAdmission =
  | {
      allowed: true;
      minuteRemaining: number;
      hourRemaining: number;
    }
  | {
      allowed: false;
      retryAfterSeconds: number;
      minuteRemaining: number;
      hourRemaining: number;
    };

export type AuthenticatedCopilotRateLimiter = {
  check(userId: string): Promise<AuthenticatedCopilotRateLimitAdmission>;
};

export type UpstashAuthenticatedCopilotRateLimiterConfig = {
  url: string;
  token: string;
  hashSalt: string;
  minuteLimit: number;
  hourLimit: number;
  ttlSeconds: number;
};

type RedisScriptClient = {
  eval(script: string, keys: string[], args: unknown[]): Promise<unknown>;
};

export class AuthenticatedCopilotRateLimitUnavailableError extends Error {
  readonly code = "COPILOT_AUTHENTICATED_RATE_LIMIT_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("Authenticated Copilot rate limiting is unavailable.");
    this.name = "AuthenticatedCopilotRateLimitUnavailableError";
  }
}

export function resolveUpstashAuthenticatedCopilotRateLimiterConfig(
  environment: Environment,
): UpstashAuthenticatedCopilotRateLimiterConfig {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new AuthenticatedCopilotRateLimitUnavailableError("redis_configuration_missing");
  }

  const hashSalt = environment.VISEPANDA_IP_HASH_SALT?.trim();
  if (!hashSalt || hashSalt.length < 32) {
    throw new AuthenticatedCopilotRateLimitUnavailableError("hash_salt_missing");
  }

  const policy = resolvePublicRuntimePolicy(environment);
  return {
    url,
    token,
    hashSalt,
    minuteLimit: policy.authenticatedMinuteLimit,
    hourLimit: policy.authenticatedHourLimit,
    ttlSeconds: AUTHENTICATED_COPILOT_RATE_LIMIT_TTL_SECONDS,
  };
}

export function createUpstashAuthenticatedCopilotRateLimiter(
  config: UpstashAuthenticatedCopilotRateLimiterConfig,
  client: RedisScriptClient = new Redis({
    url: config.url,
    token: config.token,
    enableTelemetry: false,
    signal: () => AbortSignal.timeout(1_500),
  }),
): AuthenticatedCopilotRateLimiter {
  return {
    async check(userId) {
      const now = Date.now();
      const key = `vp:copilot:authenticated-rate:${digest(userId, config.hashSalt)}`;
      let result: unknown;
      try {
        result = await client.eval(
          SLIDING_WINDOW_SCRIPT,
          [key],
          [
            now,
            config.minuteLimit,
            60_000,
            config.hourLimit,
            3_600_000,
            config.ttlSeconds,
            `${now}:${randomUUID()}`,
          ],
        );
      } catch {
        throw new AuthenticatedCopilotRateLimitUnavailableError("redis_request_failed");
      }
      return parseAdmission(result);
    },
  };
}

export function createInMemoryAuthenticatedCopilotRateLimiter({
  minuteLimit = 20,
  hourLimit = 120,
  now = () => Date.now(),
}: {
  minuteLimit?: number;
  hourLimit?: number;
  now?: () => number;
} = {}): AuthenticatedCopilotRateLimiter {
  const entries = new Map<string, number[]>();
  return {
    async check(userId) {
      const currentTime = now();
      const hourCutoff = currentTime - 3_600_000;
      const timestamps = (entries.get(userId) ?? []).filter((value) => value > hourCutoff);
      entries.set(userId, timestamps);

      const minuteCutoff = currentTime - 60_000;
      const minuteTimestamps = timestamps.filter((value) => value > minuteCutoff);
      const minuteBlocked = minuteTimestamps.length >= minuteLimit;
      const hourBlocked = timestamps.length >= hourLimit;
      if (minuteBlocked || hourBlocked) {
        const minuteRetry = minuteBlocked
          ? retryAfterSeconds(minuteTimestamps[0]!, 60_000, currentTime)
          : 0;
        const hourRetry = hourBlocked
          ? retryAfterSeconds(timestamps[0]!, 3_600_000, currentTime)
          : 0;
        return {
          allowed: false,
          retryAfterSeconds: Math.max(minuteRetry, hourRetry),
          minuteRemaining: Math.max(0, minuteLimit - minuteTimestamps.length),
          hourRemaining: Math.max(0, hourLimit - timestamps.length),
        };
      }

      timestamps.push(currentTime);
      return {
        allowed: true,
        minuteRemaining: minuteLimit - minuteTimestamps.length - 1,
        hourRemaining: hourLimit - timestamps.length,
      };
    },
  };
}

function digest(userId: string, hashSalt: string): string {
  return createHmac("sha256", hashSalt)
    .update(`copilot:authenticated-identity:${userId}`)
    .digest("hex");
}

function retryAfterSeconds(timestamp: number, windowMilliseconds: number, now: number): number {
  return Math.max(1, Math.ceil((timestamp + windowMilliseconds - now) / 1_000));
}

function parseAdmission(value: unknown): AuthenticatedCopilotRateLimitAdmission {
  if (!Array.isArray(value) || value.length < 4) {
    throw new AuthenticatedCopilotRateLimitUnavailableError("redis_response_invalid");
  }
  const [status, retryAfter, minuteRemaining, hourRemaining] = value.map(parseNonNegativeInteger);
  if (status === 1 && retryAfter === 0) {
    return { allowed: true, minuteRemaining: minuteRemaining!, hourRemaining: hourRemaining! };
  }
  if (status === 0 && retryAfter! > 0) {
    return {
      allowed: false,
      retryAfterSeconds: retryAfter!,
      minuteRemaining: minuteRemaining!,
      hourRemaining: hourRemaining!,
    };
  }
  throw new AuthenticatedCopilotRateLimitUnavailableError("redis_response_invalid");
}

function parseNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AuthenticatedCopilotRateLimitUnavailableError("redis_response_invalid");
  }
  return parsed;
}

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local minuteLimit = tonumber(ARGV[2])
local minuteWindow = tonumber(ARGV[3])
local hourLimit = tonumber(ARGV[4])
local hourWindow = tonumber(ARGV[5])
local ttl = tonumber(ARGV[6])
local member = ARGV[7]
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

if retryAfter > 0 then
  redis.call("EXPIRE", key, ttl)
  return {0, retryAfter, math.max(0, minuteLimit - minuteCount), math.max(0, hourLimit - hourCount)}
end

redis.call("ZADD", key, now, member)
redis.call("EXPIRE", key, ttl)
return {1, 0, minuteLimit - minuteCount - 1, hourLimit - hourCount - 1}
`;
