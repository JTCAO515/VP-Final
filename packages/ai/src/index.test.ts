import { describe, expect, it } from "vitest";
import {
  ModelRoutingError,
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
        route: "primary",
        provider: "primary",
        model: "primary-model",
        ok: false,
        failureClass: "network_error",
        costSnapshot: expect.objectContaining({
          fallbackTriggered: false,
          inputTokens: 0,
          cachedInputTokens: 0,
          outputTokens: 0,
          costUsd: "0.00000000",
        }),
      }),
      expect.objectContaining({
        route: "secondary",
        provider: "secondary",
        model: "secondary-model",
        ok: true,
        costSnapshot: expect.objectContaining({ fallbackTriggered: true }),
      }),
    ]);
  });

  it("records successful usage cost in the ledger", async () => {
    const ledger = createInMemoryCostLedger();
    const router = createModelRouter({
      ledger,
      providers: [
        createStaticProvider({
          id: "planning_primary",
          pricingProvider: "deepseek",
          model: "deepseek-v4-pro",
          usage: { inputTokens: 1_000, cachedInputTokens: 200, outputTokens: 2_000 },
        }),
      ],
    });

    const result = await router.generate({ task: "knowledge_qa", prompt: "Answer this" });

    expect(result.costSnapshot).toEqual({
      provider: "deepseek",
      model: "deepseek-v4-pro",
      effort: "medium",
      inputTokens: 1_000,
      cachedInputTokens: 200,
      outputTokens: 2_000,
      inputPricePerMillionUsd: "0.43500000",
      cachedInputPricePerMillionUsd: "0.00362500",
      outputPricePerMillionUsd: "0.87000000",
      costUsd: "0.00208873",
      pricingMissing: false,
      fallbackTriggered: false,
    });
    expect(ledger.entries()).toEqual([
      {
        task: "knowledge_qa",
        route: "planning_primary",
        provider: "deepseek",
        model: "deepseek-v4-pro",
        effort: "medium",
        inputTokens: 1_000,
        cachedInputTokens: 200,
        outputTokens: 2_000,
        costUsd: result.costUsd,
        costSnapshot: result.costSnapshot,
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
          usage: { inputTokens: 5, cachedInputTokens: 0, outputTokens: 7 },
        }),
      ],
    });

    const result = await router.generate({ task: "trip_writer", prompt: "Plan a trip" });

    expect(result.attempts).toEqual([
      expect.objectContaining({
        route: "primary",
        provider: "primary",
        model: "primary-model",
        ok: false,
        failureClass: "timeout",
      }),
      expect.objectContaining({
        route: "fallback",
        provider: "fallback",
        model: "fallback-model",
        ok: true,
        inputTokens: 5,
        outputTokens: 7,
        costSnapshot: expect.objectContaining({
          inputTokens: 5,
          cachedInputTokens: 0,
          outputTokens: 7,
          fallbackTriggered: true,
        }),
      }),
    ]);
  });

  it("emits an auditable zero snapshot when model pricing is not registered", async () => {
    const router = createModelRouter({
      providers: [
        createStaticProvider({
          id: "router_primary",
          pricingProvider: "dashscope",
          model: "unregistered-qwen",
          usage: { inputTokens: 10, cachedInputTokens: 3, outputTokens: 5 },
        }),
      ],
    });

    await expect(
      router.generate({ task: "router", prompt: "Classify", effort: "low" }),
    ).resolves.toMatchObject({
      costSnapshot: {
        provider: "dashscope",
        model: "unregistered-qwen",
        inputTokens: 10,
        cachedInputTokens: 3,
        outputTokens: 5,
        inputPricePerMillionUsd: "0",
        cachedInputPricePerMillionUsd: "0",
        outputPricePerMillionUsd: "0",
        costUsd: "0.00000000",
        pricingMissing: true,
      },
    });
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
