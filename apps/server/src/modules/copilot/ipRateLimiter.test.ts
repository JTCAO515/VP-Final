import { describe, expect, it } from "vitest";
import {
  CopilotIpRateLimitUnavailableError,
  createInMemoryCopilotIpRateLimiter,
  createUpstashCopilotIpRateLimiter,
  resolveUpstashCopilotIpRateLimiterConfig,
} from "./ipRateLimiter.js";

describe("CopilotIpRateLimiter", () => {
  it("requires Redis, a server-only hash salt, and positive integer limits", () => {
    expect(() =>
      resolveUpstashCopilotIpRateLimiterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "configured",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "COPILOT_IP_RATE_LIMIT_UNAVAILABLE",
        reason: "hash_salt_missing",
      }),
    );

    expect(() =>
      resolveUpstashCopilotIpRateLimiterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "configured",
        VISEPANDA_IP_HASH_SALT: "s".repeat(32),
        VISEPANDA_COPILOT_IP_RATE_LIMIT_MINUTE: "0",
      }),
    ).toThrowError(expect.objectContaining({ reason: "minute_limit_invalid" }));
  });

  it("uses an HMAC-only Redis key and never sends the raw address or salt to Redis", async () => {
    const calls: { keys: string[]; args: unknown[] }[] = [];
    const limiter = createUpstashCopilotIpRateLimiter(
      {
        url: "https://redis.example.test",
        token: "configured",
        hashSalt: "private-test-salt-that-is-at-least-32-bytes",
        minuteLimit: 10,
        hourLimit: 60,
        ttlSeconds: 3_600,
      },
      {
        async eval(_script, keys, args) {
          calls.push({ keys, args });
          return [1, 0, 9, 59];
        },
      },
    );

    await expect(limiter.check("203.0.113.42")).resolves.toEqual({
      allowed: true,
      minuteRemaining: 9,
      hourRemaining: 59,
    });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.keys).toEqual([expect.stringMatching(/^vp:copilot:ip-rate:[a-f0-9]{64}$/)]);
    expect(JSON.stringify(calls[0])).not.toContain("203.0.113.42");
    expect(JSON.stringify(calls[0])).not.toContain("private-test-salt");
  });

  it("returns the atomic retry interval when either window is exhausted", async () => {
    const limiter = createUpstashCopilotIpRateLimiter(
      {
        url: "https://redis.example.test",
        token: "configured",
        hashSalt: "private-test-salt-that-is-at-least-32-bytes",
        minuteLimit: 10,
        hourLimit: 60,
        ttlSeconds: 3_600,
      },
      {
        async eval() {
          return [0, 27, 0, 41];
        },
      },
    );

    await expect(limiter.check("2001:db8::8")).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 27,
      minuteRemaining: 0,
      hourRemaining: 41,
    });
  });

  it("enforces minute and hour windows independently in the in-memory reference", async () => {
    let now = 1_000_000;
    const limiter = createInMemoryCopilotIpRateLimiter({
      minuteLimit: 2,
      hourLimit: 3,
      now: () => now,
    });

    await expect(limiter.check("203.0.113.1")).resolves.toMatchObject({ allowed: true });
    await expect(limiter.check("203.0.113.1")).resolves.toEqual({
      allowed: true,
      minuteRemaining: 0,
      hourRemaining: 1,
    });
    await expect(limiter.check("203.0.113.1")).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    });

    now += 61_000;
    await expect(limiter.check("203.0.113.1")).resolves.toEqual({
      allowed: true,
      minuteRemaining: 1,
      hourRemaining: 0,
    });
    await expect(limiter.check("203.0.113.1")).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 3_539,
    });
    await expect(limiter.check("203.0.113.2")).resolves.toMatchObject({ allowed: true });
  });

  it("fails closed on an invalid Redis response", async () => {
    const limiter = createUpstashCopilotIpRateLimiter(
      {
        url: "https://redis.example.test",
        token: "configured",
        hashSalt: "private-test-salt-that-is-at-least-32-bytes",
        minuteLimit: 10,
        hourLimit: 60,
        ttlSeconds: 3_600,
      },
      {
        async eval() {
          return [1];
        },
      },
    );

    await expect(limiter.check("203.0.113.42")).rejects.toBeInstanceOf(
      CopilotIpRateLimitUnavailableError,
    );
  });
});
