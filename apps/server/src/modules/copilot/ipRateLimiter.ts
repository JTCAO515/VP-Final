import { createHmac, randomUUID } from "node:crypto";
import { Redis } from "@upstash/redis";

export const DEFAULT_COPILOT_IP_MINUTE_LIMIT = 10;
export const DEFAULT_COPILOT_IP_HOUR_LIMIT = 60;
export const COPILOT_IP_RATE_LIMIT_TTL_SECONDS = 60 * 60;

type Environment = Readonly<Record<string, string | undefined>>;

export type CopilotIpRateLimitAdmission =
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

export type CopilotIpRateLimiter = {
  check(clientAddress: string): Promise<CopilotIpRateLimitAdmission>;
};

export type UpstashCopilotIpRateLimiterConfig = {
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

export class CopilotIpRateLimitUnavailableError extends Error {
  readonly code = "COPILOT_IP_RATE_LIMIT_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("Copilot IP rate limiting is unavailable.");
    this.name = "CopilotIpRateLimitUnavailableError";
  }
}

export function resolveUpstashCopilotIpRateLimiterConfig(
  environment: Environment,
): UpstashCopilotIpRateLimiterConfig {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (!url || !token) throw new CopilotIpRateLimitUnavailableError("redis_configuration_missing");

  const hashSalt = environment.VISEPANDA_IP_HASH_SALT?.trim();
  if (!hashSalt || hashSalt.length < 32) {
    throw new CopilotIpRateLimitUnavailableError("hash_salt_missing");
  }

  const minuteLimit = positiveInteger(
    environment.VISEPANDA_COPILOT_IP_RATE_LIMIT_MINUTE,
    DEFAULT_COPILOT_IP_MINUTE_LIMIT,
    "minute_limit_invalid",
  );
  const hourLimit = positiveInteger(
    environment.VISEPANDA_COPILOT_IP_RATE_LIMIT_HOUR,
    DEFAULT_COPILOT_IP_HOUR_LIMIT,
    "hour_limit_invalid",
  );

  return {
    url,
    token,
    hashSalt,
    minuteLimit,
    hourLimit,
    ttlSeconds: COPILOT_IP_RATE_LIMIT_TTL_SECONDS,
  };
}

export function createUpstashCopilotIpRateLimiter(
  config: UpstashCopilotIpRateLimiterConfig,
  client: RedisScriptClient = new Redis({
    url: config.url,
    token: config.token,
    enableTelemetry: false,
    signal: () => AbortSignal.timeout(1_500),
  }),
): CopilotIpRateLimiter {
  return {
    async check(clientAddress) {
      const now = Date.now();
      const key = `vp:copilot:ip-rate:${digest(clientAddress, config.hashSalt)}`;
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
        throw new CopilotIpRateLimitUnavailableError("redis_request_failed");
      }
      return parseAdmission(result);
    },
  };
}

export function createInMemoryCopilotIpRateLimiter({
  minuteLimit = DEFAULT_COPILOT_IP_MINUTE_LIMIT,
  hourLimit = DEFAULT_COPILOT_IP_HOUR_LIMIT,
  now = () => Date.now(),
}: {
  minuteLimit?: number;
  hourLimit?: number;
  now?: () => number;
} = {}): CopilotIpRateLimiter {
  const entries = new Map<string, number[]>();
  return {
    async check(clientAddress) {
      const currentTime = now();
      const hourCutoff = currentTime - 3_600_000;
      const timestamps = (entries.get(clientAddress) ?? []).filter((value) => value > hourCutoff);
      entries.set(clientAddress, timestamps);

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

function positiveInteger(raw: string | undefined, fallback: number, reason: string): number {
  const value = raw?.trim() ? Number(raw) : fallback;
  if (!Number.isInteger(value) || value < 1) {
    throw new CopilotIpRateLimitUnavailableError(reason);
  }
  return value;
}

function digest(clientAddress: string, hashSalt: string): string {
  return createHmac("sha256", hashSalt).update(clientAddress).digest("hex");
}

function retryAfterSeconds(timestamp: number, windowMilliseconds: number, now: number): number {
  return Math.max(1, Math.ceil((timestamp + windowMilliseconds - now) / 1_000));
}

function parseAdmission(value: unknown): CopilotIpRateLimitAdmission {
  if (!Array.isArray(value) || value.length < 4) {
    throw new CopilotIpRateLimitUnavailableError("redis_response_invalid");
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
  throw new CopilotIpRateLimitUnavailableError("redis_response_invalid");
}

function parseNonNegativeInteger(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new CopilotIpRateLimitUnavailableError("redis_response_invalid");
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
