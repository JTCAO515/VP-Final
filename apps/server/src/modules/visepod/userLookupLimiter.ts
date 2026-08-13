import { createHmac, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

export const DEFAULT_VISEPOD_STUDIO_USER_LOOKUP_MINUTE_LIMIT = 6;
export const DEFAULT_VISEPOD_STUDIO_USER_LOOKUP_HOUR_LIMIT = 30;
export const VISEPOD_STUDIO_USER_LOOKUP_RATE_LIMIT_TTL_SECONDS = 60 * 60;

type Environment = Readonly<Record<string, string | undefined>>;

export type VisePodStudioUserLookupRateLimitAdmission =
  | { allowed: true; minuteRemaining: number; hourRemaining: number }
  | {
      allowed: false;
      retryAfterSeconds: number;
      minuteRemaining: number;
      hourRemaining: number;
    };

export type VisePodStudioUserLookupRateLimiter = {
  check(opsUserId: string): Promise<VisePodStudioUserLookupRateLimitAdmission>;
};

export type UpstashVisePodStudioUserLookupRateLimiterConfig = {
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

export class VisePodStudioUserLookupRateLimitUnavailableError extends Error {
  readonly code = "USER_LOOKUP_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("VisePod Studio user lookup rate limiting is unavailable.");
    this.name = "VisePodStudioUserLookupRateLimitUnavailableError";
  }
}

export function resolveUpstashVisePodStudioUserLookupRateLimiterConfig(
  environment: Environment,
): UpstashVisePodStudioUserLookupRateLimiterConfig {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) {
    throw new VisePodStudioUserLookupRateLimitUnavailableError("redis_configuration_missing");
  }

  const hashSalt = environment.VISEPOD_STUDIO_LOOKUP_RATE_LIMIT_SALT?.trim();
  if (!hashSalt || hashSalt.length < 32) {
    throw new VisePodStudioUserLookupRateLimitUnavailableError("hash_salt_missing");
  }

  return {
    url,
    token,
    hashSalt,
    minuteLimit: positiveInteger(
      environment.VISEPOD_STUDIO_USER_LOOKUP_RATE_LIMIT_MINUTE,
      DEFAULT_VISEPOD_STUDIO_USER_LOOKUP_MINUTE_LIMIT,
      "minute_limit_invalid",
    ),
    hourLimit: positiveInteger(
      environment.VISEPOD_STUDIO_USER_LOOKUP_RATE_LIMIT_HOUR,
      DEFAULT_VISEPOD_STUDIO_USER_LOOKUP_HOUR_LIMIT,
      "hour_limit_invalid",
    ),
    ttlSeconds: VISEPOD_STUDIO_USER_LOOKUP_RATE_LIMIT_TTL_SECONDS,
  };
}

export function createUpstashVisePodStudioUserLookupRateLimiter(
  config: UpstashVisePodStudioUserLookupRateLimiterConfig,
  client: RedisScriptClient = new Redis({
    url: config.url,
    token: config.token,
    enableTelemetry: false,
    signal: () => AbortSignal.timeout(1_500),
  }),
): VisePodStudioUserLookupRateLimiter {
  return {
    async check(opsUserId) {
      const now = Date.now();
      const key = `vp:visepod:exact-user-lookup-rate:${digest(opsUserId, config.hashSalt)}`;
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
        throw new VisePodStudioUserLookupRateLimitUnavailableError("redis_request_failed");
      }
      return parseAdmission(result);
    },
  };
}

export function createInMemoryVisePodStudioUserLookupRateLimiter({
  minuteLimit = DEFAULT_VISEPOD_STUDIO_USER_LOOKUP_MINUTE_LIMIT,
  hourLimit = DEFAULT_VISEPOD_STUDIO_USER_LOOKUP_HOUR_LIMIT,
  now = () => Date.now(),
}: {
  minuteLimit?: number;
  hourLimit?: number;
  now?: () => number;
} = {}): VisePodStudioUserLookupRateLimiter {
  const entries = new Map<string, number[]>();
  return {
    async check(opsUserId) {
      const currentTime = now();
      const hourCutoff = currentTime - 3_600_000;
      const timestamps = (entries.get(opsUserId) ?? []).filter((value) => value > hourCutoff);
      entries.set(opsUserId, timestamps);
      const minuteTimestamps = timestamps.filter((value) => value > currentTime - 60_000);
      const minuteBlocked = minuteTimestamps.length >= minuteLimit;
      const hourBlocked = timestamps.length >= hourLimit;
      if (minuteBlocked || hourBlocked) {
        return {
          allowed: false,
          retryAfterSeconds: Math.max(
            minuteBlocked ? retryAfterSeconds(minuteTimestamps[0]!, 60_000, currentTime) : 0,
            hourBlocked ? retryAfterSeconds(timestamps[0]!, 3_600_000, currentTime) : 0,
          ),
          minuteRemaining: Math.max(0, minuteLimit - minuteTimestamps.length),
          hourRemaining: Math.max(0, hourLimit - timestamps.length),
        };
      }
      timestamps.push(currentTime);
      return {
        allowed: true,
        minuteRemaining: minuteLimit - minuteTimestamps.length - 1,
        hourRemaining: hourLimit - timestamps.length - 1,
      };
    },
  };
}

function positiveInteger(raw: string | undefined, fallback: number, reason: string): number {
  const value = raw?.trim() ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new VisePodStudioUserLookupRateLimitUnavailableError(reason);
  }
  return value;
}

function digest(opsUserId: string, hashSalt: string): string {
  return createHmac("sha256", hashSalt)
    .update(`visepod:exact-user-lookup-ops:${opsUserId}`)
    .digest("hex");
}

function retryAfterSeconds(timestamp: number, windowMilliseconds: number, now: number): number {
  return Math.max(1, Math.ceil((timestamp + windowMilliseconds - now) / 1_000));
}

function parseAdmission(value: unknown): VisePodStudioUserLookupRateLimitAdmission {
  if (!Array.isArray(value) || value.length < 4) {
    throw new VisePodStudioUserLookupRateLimitUnavailableError("redis_response_invalid");
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
  throw new VisePodStudioUserLookupRateLimitUnavailableError("redis_response_invalid");
}

function parseNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new VisePodStudioUserLookupRateLimitUnavailableError("redis_response_invalid");
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
