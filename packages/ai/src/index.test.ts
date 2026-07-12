import { describe, expect, it } from "vitest";
import {
  ModelRoutingError,
  calculateCostUsd,
  createInMemoryCostLedger,
  createModelRouter,
  createStaticProvider,
  ModelProviderError,
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
      expect.objectContaining({
        provider: "primary",
        model: "primary-model",
        ok: false,
        failureClass: "network_error",
      }),
      expect.objectContaining({ provider: "secondary", model: "secondary-model", ok: true }),
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
        expect.objectContaining({
          provider: "primary",
          model: "primary-model",
          ok: false,
          failureClass: "network_error",
        }),
        expect.objectContaining({
          provider: "secondary",
          model: "secondary-model",
          ok: false,
          failureClass: "network_error",
        }),
      ],
    });
  });

  it("preserves safe timeout metadata while falling back", async () => {
    const router = createModelRouter({
      providers: [
        {
          id: "primary",
          model: "primary-model",
          async generate() {
            throw new ModelProviderError("timeout");
          },
        },
        createStaticProvider({
          id: "fallback",
          model: "fallback-model",
          usage: { inputTokens: 5, outputTokens: 7 },
        }),
      ],
    });

    const result = await router.generate({ task: "trip_writer", prompt: "Plan a trip" });

    expect(result.attempts).toEqual([
      expect.objectContaining({
        provider: "primary",
        model: "primary-model",
        ok: false,
        failureClass: "timeout",
      }),
      expect.objectContaining({
        provider: "fallback",
        model: "fallback-model",
        ok: true,
        inputTokens: 5,
        outputTokens: 7,
      }),
    ]);
  });

  it("stops before provider invocation when the total budget is exhausted", async () => {
    const router = createModelRouter({
      totalTimeoutMs: 0,
      providers: [createStaticProvider({ id: "primary", model: "primary-model" })],
    });

    await expect(router.generate({ task: "router", prompt: "Classify" })).rejects.toMatchObject({
      attempts: [
        expect.objectContaining({
          provider: "primary",
          failureClass: "total_timeout",
        }),
      ],
    });
  });
});

describe("calculateCostUsd", () => {
  it("returns zero when pricing is not configured", () => {
    expect(calculateCostUsd({ inputTokens: 10, outputTokens: 20 })).toBe(0);
  });
});
