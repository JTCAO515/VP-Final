import { describe, expect, it } from "vitest";
import {
  ModelRoutingError,
  calculateCostUsd,
  createInMemoryCostLedger,
  createModelRouter,
  createStaticProvider,
  type ModelEffort,
} from "./index.js";

describe("createModelRouter", () => {
  it("passes effort to the selected provider", async () => {
    const efforts: ModelEffort[] = [];
    const router = createModelRouter({
      providers: [
        createStaticProvider({
          id: "primary",
          model: "primary-model",
          onGenerate: (request) => efforts.push(request.effort),
        }),
      ],
    });

    const result = await router.generate({
      task: "router",
      prompt: "Classify this",
      effort: "high",
    });

    expect(result.effort).toBe("high");
    expect(efforts).toEqual(["high"]);
  });

  it("falls back to the second provider when the first fails", async () => {
    const router = createModelRouter({
      providers: [
        createStaticProvider({ id: "primary", model: "primary-model", failWith: "timeout" }),
        createStaticProvider({ id: "secondary", model: "secondary-model", content: "fallback" }),
      ],
    });

    const result = await router.generate({ task: "trip_writer", prompt: "Plan a trip" });

    expect(result.provider).toBe("secondary");
    expect(result.content).toBe("fallback");
    expect(result.attempts).toEqual([
      { provider: "primary", ok: false, error: "timeout" },
      { provider: "secondary", ok: true },
    ]);
  });

  it("records successful usage cost in the ledger", async () => {
    const ledger = createInMemoryCostLedger();
    const router = createModelRouter({
      ledger,
      providers: [
        createStaticProvider({
          id: "primary",
          model: "costed-model",
          usage: { inputTokens: 1_000, outputTokens: 2_000 },
          pricing: { inputUsdPerMillionTokens: 0.5, outputUsdPerMillionTokens: 1.5 },
        }),
      ],
    });

    const result = await router.generate({ task: "knowledge_qa", prompt: "Answer this" });

    expect(result.costUsd).toBeCloseTo(0.0035);
    expect(ledger.entries()).toEqual([
      {
        task: "knowledge_qa",
        provider: "primary",
        model: "costed-model",
        effort: "medium",
        inputTokens: 1_000,
        outputTokens: 2_000,
        costUsd: result.costUsd,
      },
    ]);
  });

  it("throws with attempt details when every provider fails", async () => {
    const router = createModelRouter({
      providers: [
        createStaticProvider({ id: "primary", model: "primary-model", failWith: "timeout" }),
        createStaticProvider({ id: "secondary", model: "secondary-model", failWith: "quota" }),
      ],
    });

    await expect(router.generate({ task: "router", prompt: "Hello" })).rejects.toMatchObject({
      name: "ModelRoutingError",
      attempts: [
        { provider: "primary", ok: false, error: "timeout" },
        { provider: "secondary", ok: false, error: "quota" },
      ],
    });
  });
});

describe("calculateCostUsd", () => {
  it("returns zero when pricing is not configured", () => {
    expect(calculateCostUsd({ inputTokens: 10, outputTokens: 20 })).toBe(0);
  });
});
