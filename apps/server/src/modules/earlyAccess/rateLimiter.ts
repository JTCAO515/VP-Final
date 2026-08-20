import {
  COPILOT_IP_RATE_LIMIT_TTL_SECONDS,
  createInMemoryCopilotIpRateLimiter,
  createUpstashCopilotIpRateLimiter,
  type CopilotIpRateLimitAdmission,
  type CopilotIpRateLimiter,
  type UpstashCopilotIpRateLimiterConfig,
} from "../copilot/ipRateLimiter.js";

export const EARLY_ACCESS_RATE_LIMIT_PER_HOUR = 5;

type Environment = Readonly<Record<string, string | undefined>>;

export type EarlyAccessRateLimiter = {
  check(clientAddress: string): Promise<CopilotIpRateLimitAdmission>;
};

export class EarlyAccessRateLimitUnavailableError extends Error {
  readonly code = "EARLY_ACCESS_RATE_LIMIT_UNAVAILABLE";

  constructor(readonly reason: string) {
    super("Early Access rate limiting is unavailable.");
  }
}

export function createEarlyAccessRateLimiter(
  delegate: CopilotIpRateLimiter,
): EarlyAccessRateLimiter {
  return {
    // The prefix is included before HMAC hashing, so Early Access never shares a Redis bucket with Copilot.
    check(clientAddress) {
      return delegate.check(`early-access:${clientAddress}`);
    },
  };
}

export function createInMemoryEarlyAccessRateLimiter(now?: () => number): EarlyAccessRateLimiter {
  return createEarlyAccessRateLimiter(
    createInMemoryCopilotIpRateLimiter({
      minuteLimit: EARLY_ACCESS_RATE_LIMIT_PER_HOUR,
      hourLimit: EARLY_ACCESS_RATE_LIMIT_PER_HOUR,
      ...(now ? { now } : {}),
    }),
  );
}

export function resolveEarlyAccessRateLimiterConfig(
  environment: Environment,
): UpstashCopilotIpRateLimiterConfig {
  const url = environment.UPSTASH_REDIS_REST_URL?.trim();
  const token = environment.UPSTASH_REDIS_REST_TOKEN?.trim();
  const hashSalt = environment.VISEPANDA_IP_HASH_SALT?.trim();
  if (!url || !token) throw new EarlyAccessRateLimitUnavailableError("redis_configuration_missing");
  if (!hashSalt || hashSalt.length < 32) {
    throw new EarlyAccessRateLimitUnavailableError("hash_salt_missing");
  }
  return {
    url,
    token,
    hashSalt,
    minuteLimit: EARLY_ACCESS_RATE_LIMIT_PER_HOUR,
    hourLimit: EARLY_ACCESS_RATE_LIMIT_PER_HOUR,
    ttlSeconds: COPILOT_IP_RATE_LIMIT_TTL_SECONDS,
  };
}

export function createUpstashEarlyAccessRateLimiter(
  config: UpstashCopilotIpRateLimiterConfig,
): EarlyAccessRateLimiter {
  return createEarlyAccessRateLimiter(createUpstashCopilotIpRateLimiter(config));
}
