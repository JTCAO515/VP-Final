import { describe, expect, it } from "vitest";
import {
  VisePodStudioUserLookupRateLimitUnavailableError,
  createInMemoryVisePodStudioUserLookupRateLimiter,
  createUpstashVisePodStudioUserLookupRateLimiter,
  resolveUpstashVisePodStudioUserLookupRateLimiterConfig,
} from "./userLookupLimiter.js";

describe("VisePod Studio exact-user lookup rate limiter", () => {
  it("requires Redis and a dedicated server-only salt", () => {
    expect(() => resolveUpstashVisePodStudioUserLookupRateLimiterConfig({})).toThrowError(
      expect.objectContaining({ reason: "redis_configuration_missing" }),
    );
    expect(() =>
      resolveUpstashVisePodStudioUserLookupRateLimiterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "configured",
      }),
    ).toThrowError(expect.objectContaining({ reason: "hash_salt_missing" }));
  });

  it("sends only a domain-separated HMAC key to Redis", async () => {
    const calls: { keys: string[]; args: unknown[] }[] = [];
    const limiter = createUpstashVisePodStudioUserLookupRateLimiter(
      {
        url: "https://redis.example.test",
        token: "configured",
        hashSalt: "private-test-salt-that-is-at-least-32-bytes",
        minuteLimit: 6,
        hourLimit: 30,
        ttlSeconds: 3_600,
      },
      {
        async eval(_script, keys, args) {
          calls.push({ keys, args });
          return [1, 0, 5, 29];
        },
      },
    );
    await expect(limiter.check("34000000-0000-4000-8000-000000000001")).resolves.toEqual({
      allowed: true,
      minuteRemaining: 5,
      hourRemaining: 29,
    });
    expect(calls[0]?.keys).toEqual([
      expect.stringMatching(/^vp:visepod:exact-user-lookup-rate:[a-f0-9]{64}$/),
    ]);
    expect(JSON.stringify(calls[0])).not.toContain("34000000-0000-4000-8000-000000000001");
    expect(JSON.stringify(calls[0])).not.toContain("private-test-salt");
  });

  it("enforces bounded windows and fails closed on invalid Redis output", async () => {
    let now = 1_000_000;
    const memory = createInMemoryVisePodStudioUserLookupRateLimiter({
      minuteLimit: 1,
      hourLimit: 2,
      now: () => now,
    });
    await expect(memory.check("ops-a")).resolves.toMatchObject({ allowed: true });
    await expect(memory.check("ops-a")).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
    });
    now += 61_000;
    await expect(memory.check("ops-a")).resolves.toMatchObject({ allowed: true });

    const unavailable = createUpstashVisePodStudioUserLookupRateLimiter(
      {
        url: "https://redis.example.test",
        token: "configured",
        hashSalt: "private-test-salt-that-is-at-least-32-bytes",
        minuteLimit: 6,
        hourLimit: 30,
        ttlSeconds: 3_600,
      },
      {
        async eval() {
          return [1];
        },
      },
    );
    await expect(unavailable.check("ops-a")).rejects.toBeInstanceOf(
      VisePodStudioUserLookupRateLimitUnavailableError,
    );
  });
});
