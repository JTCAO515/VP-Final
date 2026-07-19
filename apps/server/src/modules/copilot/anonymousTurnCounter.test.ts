import { describe, expect, it } from "vitest";
import {
  AnonymousTurnControlUnavailableError,
  createInMemoryAnonymousTurnCounter,
  createUpstashAnonymousTurnCounter,
  resolveUpstashAnonymousTurnCounterConfig,
} from "./anonymousTurnCounter.js";

describe("anonymous Copilot turn counter", () => {
  it("admits three completed turns and rejects the fourth", async () => {
    const counter = createInMemoryAnonymousTurnCounter({ limit: 3 });

    for (let turn = 1; turn <= 3; turn += 1) {
      const reservation = await counter.reserve("anonymous-a");
      expect(reservation.allowed).toBe(true);
      if (reservation.allowed) {
        await expect(reservation.complete()).resolves.toEqual({
          completedTurns: turn,
          limit: 3,
          remaining: 3 - turn,
        });
      }
    }

    await expect(counter.reserve("anonymous-a")).resolves.toEqual({
      allowed: false,
      reason: "limit_reached",
      usage: { completedTurns: 3, limit: 3, remaining: 0 },
    });
  });

  it("does not consume a turn when a failed request releases its reservation", async () => {
    const counter = createInMemoryAnonymousTurnCounter({ limit: 1 });
    const failed = await counter.reserve("anonymous-a");
    expect(failed.allowed).toBe(true);
    if (failed.allowed) await failed.release();

    const retry = await counter.reserve("anonymous-a");
    expect(retry.allowed).toBe(true);
    if (retry.allowed) {
      await expect(retry.complete()).resolves.toMatchObject({ completedTurns: 1, remaining: 0 });
    }
  });

  it("counts active reservations when enforcing the limit atomically", async () => {
    const counter = createInMemoryAnonymousTurnCounter({ limit: 2 });
    const first = await counter.reserve("anonymous-a");
    const second = await counter.reserve("anonymous-a");

    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    await expect(counter.reserve("anonymous-a")).resolves.toEqual({
      allowed: false,
      reason: "capacity_reserved",
      usage: { completedTurns: 0, limit: 2, remaining: 2 },
    });

    if (first.allowed) await first.release();
    await expect(counter.reserve("anonymous-a")).resolves.toMatchObject({ allowed: true });
  });

  it("expires an inactive anonymous counter", async () => {
    let now = 1_000;
    const counter = createInMemoryAnonymousTurnCounter({
      limit: 1,
      ttlSeconds: 10,
      now: () => now,
    });
    const first = await counter.reserve("anonymous-a");
    if (first.allowed) await first.complete();
    await expect(counter.reserve("anonymous-a")).resolves.toMatchObject({ allowed: false });

    now += 10_001;
    await expect(counter.reserve("anonymous-a")).resolves.toMatchObject({ allowed: true });
  });
});

describe("Upstash anonymous turn counter", () => {
  it("uses canonical environment names and defaults the limit to three", () => {
    expect(
      resolveUpstashAnonymousTurnCounterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "configured",
      }),
    ).toMatchObject({ limit: 3, ttlSeconds: 2_592_000 });
  });

  it("fails honestly when Redis configuration or the limit is invalid", () => {
    expect(() => resolveUpstashAnonymousTurnCounterConfig({})).toThrow(
      AnonymousTurnControlUnavailableError,
    );
    expect(() =>
      resolveUpstashAnonymousTurnCounterConfig({
        UPSTASH_REDIS_REST_URL: "https://redis.example.test",
        UPSTASH_REDIS_REST_TOKEN: "configured",
        VISEPANDA_ANON_TURN_LIMIT: "0",
      }),
    ).toThrow(expect.objectContaining({ reason: "turn_limit_invalid" }));
  });

  it("hashes the anonymous id before sending a key to Redis", async () => {
    const calls: Array<{ keys: string[]; args: unknown[] }> = [];
    const responses: unknown[] = [[1, 0, 1], 1];
    const counter = createUpstashAnonymousTurnCounter(
      {
        url: "https://redis.example.test",
        token: "configured",
        limit: 3,
        ttlSeconds: 60,
      },
      {
        async eval(_script, keys, args) {
          calls.push({ keys, args });
          return responses.shift();
        },
      },
    );

    const reservation = await counter.reserve("raw-anonymous-id");
    expect(reservation.allowed).toBe(true);
    if (reservation.allowed) await reservation.complete();

    expect(calls[0]?.keys[0]).toMatch(/^vp:copilot:anon-turns:[a-f0-9]{64}$/);
    expect(JSON.stringify(calls)).not.toContain("raw-anonymous-id");
  });

  it("retries an ambiguous completion with the same idempotent lease", async () => {
    const calls: Array<{ script: string; args: unknown[] }> = [];
    let completionAttempts = 0;
    const counter = createUpstashAnonymousTurnCounter(
      {
        url: "https://redis.example.test",
        token: "configured",
        limit: 3,
        ttlSeconds: 60,
      },
      {
        async eval(script, _keys, args) {
          calls.push({ script, args });
          if (calls.length === 1) return [1, 0, 1];
          completionAttempts += 1;
          if (completionAttempts === 1) throw new Error("response lost after commit");
          return 1;
        },
      },
    );

    const reservation = await counter.reserve("anonymous-a");
    expect(reservation.allowed).toBe(true);
    if (!reservation.allowed) return;
    await expect(reservation.complete()).resolves.toEqual({
      completedTurns: 1,
      limit: 3,
      remaining: 2,
    });

    expect(completionAttempts).toBe(2);
    expect(calls[1]?.script).toContain('local completionField = "done:" .. ARGV[1]');
    expect(calls[1]?.args[0]).toBe(calls[2]?.args[0]);
  });

  it("normalizes Redis failures without exposing provider details", async () => {
    const counter = createUpstashAnonymousTurnCounter(
      {
        url: "https://redis.example.test",
        token: "configured",
        limit: 3,
        ttlSeconds: 60,
      },
      {
        async eval() {
          throw new Error("configured secret and raw provider response");
        },
      },
    );

    await expect(counter.reserve("anonymous-a")).rejects.toMatchObject({
      code: "ANONYMOUS_TURN_CONTROL_UNAVAILABLE",
      reason: "redis_request_failed",
      message: "Anonymous Copilot turn control is unavailable.",
    });
  });
});
