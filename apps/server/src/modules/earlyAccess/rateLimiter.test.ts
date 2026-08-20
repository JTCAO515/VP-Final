import { describe, expect, it, vi } from "vitest";
import {
  EARLY_ACCESS_RATE_LIMIT_PER_HOUR,
  createEarlyAccessRateLimiter,
  createInMemoryEarlyAccessRateLimiter,
  resolveEarlyAccessRateLimiterConfig,
} from "./rateLimiter.js";

describe("Early Access rate limiter", () => {
  it("namespaces the trusted address before the shared limiter hashes it", async () => {
    const check = vi.fn().mockResolvedValue({
      allowed: true,
      minuteRemaining: 4,
      hourRemaining: 4,
    });
    const limiter = createEarlyAccessRateLimiter({ check });

    await limiter.check("203.0.113.8");

    expect(check).toHaveBeenCalledWith("early-access:203.0.113.8");
  });

  it("admits only five requests per trusted address in one hour", async () => {
    const limiter = createInMemoryEarlyAccessRateLimiter(() => 1_000);
    for (let index = 0; index < EARLY_ACCESS_RATE_LIMIT_PER_HOUR; index += 1) {
      await expect(limiter.check("203.0.113.8")).resolves.toMatchObject({ allowed: true });
    }
    await expect(limiter.check("203.0.113.8")).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 3600,
    });
  });

  it("requires the existing server-only Upstash and HMAC configuration", () => {
    expect(() => resolveEarlyAccessRateLimiterConfig({})).toThrowError(
      "Early Access rate limiting is unavailable.",
    );
    expect(() =>
      resolveEarlyAccessRateLimiterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "token",
        VISEPANDA_IP_HASH_SALT: "short",
      }),
    ).toThrowError("Early Access rate limiting is unavailable.");
  });
});
