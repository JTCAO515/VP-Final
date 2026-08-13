import { describe, expect, it } from "vitest";
import {
  AuthenticatedCopilotRateLimitUnavailableError,
  createInMemoryAuthenticatedCopilotRateLimiter,
  createUpstashAuthenticatedCopilotRateLimiter,
  resolveUpstashAuthenticatedCopilotRateLimiterConfig,
} from "./authenticatedRateLimiter.js";

describe("AuthenticatedCopilotRateLimiter", () => {
  it("requires Redis, a server-only hash salt, and an accepted public runtime policy", () => {
    expect(() => resolveUpstashAuthenticatedCopilotRateLimiterConfig({})).toThrowError(
      expect.objectContaining({
        code: "COPILOT_AUTHENTICATED_RATE_LIMIT_UNAVAILABLE",
        reason: "redis_configuration_missing",
      }),
    );

    expect(() =>
      resolveUpstashAuthenticatedCopilotRateLimiterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "configured",
      }),
    ).toThrowError(expect.objectContaining({ reason: "hash_salt_missing" }));

    expect(() =>
      resolveUpstashAuthenticatedCopilotRateLimiterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "configured",
        VISEPANDA_IP_HASH_SALT: "s".repeat(32),
        VISEPANDA_AUTHENTICATED_RATE_LIMIT_MINUTE: "21",
      }),
    ).toThrowError(expect.objectContaining({ reason: "authenticated_minute_limit_invalid" }));
  });

  it("uses a domain-separated HMAC key and never sends raw user identity or salt to Redis", async () => {
    const calls: { keys: string[]; args: unknown[] }[] = [];
    const limiter = createUpstashAuthenticatedCopilotRateLimiter(
      {
        url: "https://redis.example.test",
        token: "configured",
        hashSalt: "private-test-salt-that-is-at-least-32-bytes",
        minuteLimit: 20,
        hourLimit: 120,
        ttlSeconds: 3_600,
      },
      {
        async eval(_script, keys, args) {
          calls.push({ keys, args });
          return [1, 0, 19, 119];
        },
      },
    );

    await expect(limiter.check("11111111-1111-4111-8111-111111111111")).resolves.toEqual({
      allowed: true,
      minuteRemaining: 19,
      hourRemaining: 119,
    });
    expect(calls[0]?.keys).toEqual([
      expect.stringMatching(/^vp:copilot:authenticated-rate:[a-f0-9]{64}$/),
    ]);
    expect(JSON.stringify(calls[0])).not.toContain("11111111-1111-4111-8111-111111111111");
    expect(JSON.stringify(calls[0])).not.toContain("private-test-salt");
  });

  it("enforces identity-local minute and hour windows", async () => {
    let now = 1_000_000;
    const limiter = createInMemoryAuthenticatedCopilotRateLimiter({
      minuteLimit: 2,
      hourLimit: 3,
      now: () => now,
    });

    await expect(limiter.check("user-a")).resolves.toMatchObject({ allowed: true });
    await expect(limiter.check("user-a")).resolves.toEqual({
      allowed: true,
      minuteRemaining: 0,
      hourRemaining: 1,
    });
    await expect(limiter.check("user-a")).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    });
    await expect(limiter.check("user-b")).resolves.toMatchObject({ allowed: true });

    now += 61_000;
    await expect(limiter.check("user-a")).resolves.toEqual({
      allowed: true,
      minuteRemaining: 1,
      hourRemaining: 0,
    });
    await expect(limiter.check("user-a")).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 3_539,
    });
  });

  it("fails closed when Redis returns an invalid admission", async () => {
    const limiter = createUpstashAuthenticatedCopilotRateLimiter(
      {
        url: "https://redis.example.test",
        token: "configured",
        hashSalt: "private-test-salt-that-is-at-least-32-bytes",
        minuteLimit: 20,
        hourLimit: 120,
        ttlSeconds: 3_600,
      },
      {
        async eval() {
          return [1];
        },
      },
    );

    await expect(limiter.check("user-a")).rejects.toBeInstanceOf(
      AuthenticatedCopilotRateLimitUnavailableError,
    );
  });
});
