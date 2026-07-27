import { describe, expect, it } from "vitest";
import {
  TelemetryRateLimitUnavailableError,
  createInMemoryTelemetryRateLimiter,
  createUpstashTelemetryRateLimiter,
  resolveUpstashTelemetryRateLimiterConfig,
} from "./rateLimiter.js";

describe("TelemetryRateLimiter", () => {
  it("requires Redis, a server-only HMAC salt, and positive windows", () => {
    expect(() =>
      resolveUpstashTelemetryRateLimiterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "configured",
      }),
    ).toThrowError(
      expect.objectContaining({
        code: "TELEMETRY_RATE_LIMIT_UNAVAILABLE",
        reason: "hash_salt_missing",
      }),
    );

    expect(() =>
      resolveUpstashTelemetryRateLimiterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "configured",
        VISEPANDA_IP_HASH_SALT: "s".repeat(32),
        VISEPANDA_TELEMETRY_IP_RATE_LIMIT_HOUR: "0",
      }),
    ).toThrowError(expect.objectContaining({ reason: "ip_hour_limit_invalid" }));
  });

  it("uses only HMAC Redis keys and never sends raw identity, address, or salt", async () => {
    const calls: { keys: string[]; args: unknown[] }[] = [];
    const limiter = createUpstashTelemetryRateLimiter(config(), {
      async eval(_script, keys, args) {
        calls.push({ keys, args });
        return [1, 0, 59, 299, 179, 899, 0];
      },
    });

    await expect(
      limiter.check({ subject: "anon:private-anonymous-id", clientAddress: "203.0.113.42" }),
    ).resolves.toEqual({
      allowed: true,
      identityMinuteRemaining: 59,
      identityHourRemaining: 299,
      ipMinuteRemaining: 179,
      ipHourRemaining: 899,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0]?.keys).toEqual([
      expect.stringMatching(/^vp:telemetry:identity-rate:[a-f0-9]{64}$/),
      expect.stringMatching(/^vp:telemetry:ip-rate:[a-f0-9]{64}$/),
      expect.stringMatching(/^vp:telemetry:rate-rejections:[a-f0-9]{64}$/),
    ]);
    const stored = JSON.stringify(calls[0]);
    expect(stored).not.toContain("private-anonymous-id");
    expect(stored).not.toContain("203.0.113.42");
    expect(stored).not.toContain("private-test-salt");
  });

  it("returns a retry interval and bounded rejection count when either dimension is exhausted", async () => {
    const limiter = createUpstashTelemetryRateLimiter(config(), {
      async eval() {
        return [0, 27, 48, 291, 0, 771, 4];
      },
    });

    await expect(
      limiter.check({
        subject: "user:00000000-0000-4000-8000-000000000001",
        clientAddress: "2001:db8::8",
      }),
    ).resolves.toEqual({
      allowed: false,
      retryAfterSeconds: 27,
      rejectionCount: 4,
      identityMinuteRemaining: 48,
      identityHourRemaining: 291,
      ipMinuteRemaining: 0,
      ipHourRemaining: 771,
    });
  });

  it("requires both identity and trusted-network windows without partially admitting a request", async () => {
    let now = 1_000_000;
    const limiter = createInMemoryTelemetryRateLimiter({
      identityMinuteLimit: 2,
      identityHourLimit: 3,
      ipMinuteLimit: 2,
      ipHourLimit: 3,
      now: () => now,
    });
    const first = { subject: "anon:one", clientAddress: "203.0.113.1" };

    await expect(limiter.check(first)).resolves.toMatchObject({ allowed: true });
    await expect(limiter.check(first)).resolves.toEqual({
      allowed: true,
      identityMinuteRemaining: 0,
      identityHourRemaining: 1,
      ipMinuteRemaining: 0,
      ipHourRemaining: 1,
    });
    await expect(limiter.check(first)).resolves.toMatchObject({
      allowed: false,
      retryAfterSeconds: 60,
      rejectionCount: 1,
    });

    await expect(
      limiter.check({ subject: "anon:two", clientAddress: "203.0.113.1" }),
    ).resolves.toMatchObject({ allowed: false, rejectionCount: 2 });

    now += 61_000;
    await expect(
      limiter.check({ subject: "anon:two", clientAddress: "203.0.113.1" }),
    ).resolves.toMatchObject({ allowed: true });
  });

  it("fails closed on an invalid Redis response", async () => {
    const limiter = createUpstashTelemetryRateLimiter(config(), {
      async eval() {
        return [1];
      },
    });

    await expect(
      limiter.check({ subject: "anon:one", clientAddress: "203.0.113.42" }),
    ).rejects.toBeInstanceOf(TelemetryRateLimitUnavailableError);
  });
});

function config() {
  return {
    url: "https://redis.example.test",
    token: "configured",
    hashSalt: "private-test-salt-that-is-at-least-32-bytes",
    identityMinuteLimit: 60,
    identityHourLimit: 300,
    ipMinuteLimit: 180,
    ipHourLimit: 900,
    ttlSeconds: 3_600,
  };
}
