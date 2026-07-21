import { describe, expect, it } from "vitest";
import { calculateLlmCostUsd } from "./costAccounting.js";

describe("calculateLlmCostUsd", () => {
  it.each([
    {
      name: "pure cache miss",
      inputTokens: 1_000,
      cachedInputTokens: 0,
      outputTokens: 500,
      expected: "0.00100000",
    },
    {
      name: "pure cache hit",
      inputTokens: 1_000,
      cachedInputTokens: 1_000,
      outputTokens: 0,
      expected: "0.00010000",
    },
    {
      name: "mixed input",
      inputTokens: 1_000,
      cachedInputTokens: 250,
      outputTokens: 500,
      expected: "0.00090000",
    },
    {
      name: "missing cache usage degrades to all miss",
      inputTokens: 1_000,
      cachedInputTokens: 0,
      outputTokens: 0,
      expected: "0.00050000",
    },
  ])("calculates $name without floating-point arithmetic", (fixture) => {
    expect(
      calculateLlmCostUsd({
        ...fixture,
        inputMissPerMillionUsd: "0.50000000",
        inputHitPerMillionUsd: "0.10000000",
        outputPerMillionUsd: "1.00000000",
      }),
    ).toEqual({
      uncachedInputTokens: fixture.inputTokens - fixture.cachedInputTokens,
      costUsd: fixture.expected,
    });
  });

  it("rounds HALF_UP to eight decimal places", () => {
    expect(
      calculateLlmCostUsd({
        inputTokens: 1,
        cachedInputTokens: 0,
        outputTokens: 0,
        inputMissPerMillionUsd: "0.00500000",
        inputHitPerMillionUsd: "0",
        outputPerMillionUsd: "0",
      }).costUsd,
    ).toBe("0.00000001");
  });

  it("returns an auditable zero when all three price snapshots are zero", () => {
    expect(
      calculateLlmCostUsd({
        inputTokens: 100,
        cachedInputTokens: 20,
        outputTokens: 40,
        inputMissPerMillionUsd: "0",
        inputHitPerMillionUsd: "0",
        outputPerMillionUsd: "0",
      }).costUsd,
    ).toBe("0.00000000");
  });

  it("rejects invalid token subsets and imprecise price snapshots", () => {
    expect(() =>
      calculateLlmCostUsd({
        inputTokens: 10,
        cachedInputTokens: 11,
        outputTokens: 0,
        inputMissPerMillionUsd: "1",
        inputHitPerMillionUsd: "1",
        outputPerMillionUsd: "1",
      }),
    ).toThrow("cachedInputTokens must not exceed inputTokens");
    expect(() =>
      calculateLlmCostUsd({
        inputTokens: 1,
        cachedInputTokens: 0,
        outputTokens: 0,
        inputMissPerMillionUsd: "0.123456789",
        inputHitPerMillionUsd: "0",
        outputPerMillionUsd: "0",
      }),
    ).toThrow("at most eight decimal places");
  });
});
