import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDemoModelRuntime,
  DemoModelExecutionError,
  DemoModelResponseError,
  DemoModelUnavailableError,
  createDemoCopilotModelDependencies,
} from "./modelRuntime.js";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("demo model runtime", () => {
  it("fails honestly when a route lacks its configured provider credentials", async () => {
    const runtime = createDemoModelRuntime({
      VISEPANDA_MODEL_ROUTER_PRIMARY: "catalog-confirmed-qwen",
    });

    await expect(
      runtime.generate("router", { task: "router", prompt: "classify", effort: "low" }),
    ).rejects.toEqual(expect.any(DemoModelUnavailableError));
  });

  it("preserves safe failed attempts when every configured provider fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(new Response("upstream detail", { status: 503 })),
    );
    const runtime = createDemoModelRuntime({
      DASHSCOPE_API_KEY: "test-dashscope-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
      VISEPANDA_MODEL_ROUTER_PRIMARY: "catalog-confirmed-qwen",
      VISEPANDA_MODEL_ROUTER_FALLBACK: "catalog-confirmed-deepseek",
    });

    await expect(
      runtime.generate("router", { task: "router", prompt: "classify", effort: "low" }),
    ).rejects.toMatchObject({
      name: DemoModelExecutionError.name,
      code: "MODEL_REQUEST_FAILED",
      attempts: [
        { route: "router_primary", provider: "dashscope", failureClass: "http_error" },
        { route: "router_fallback", provider: "deepseek", failureClass: "http_error" },
      ],
    });
  });

  it("returns the exact cache-aware cost snapshot for a successful attempt", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            model: "kimi-k2.6",
            choices: [{ message: { content: '{"intent":"chat_only"}' } }],
            usage: {
              prompt_tokens: 1_000,
              completion_tokens: 500,
              prompt_tokens_details: { cached_tokens: 250 },
            },
          }),
          { status: 200 },
        ),
      ),
    );
    const runtime = createDemoModelRuntime({
      MOONSHOT_API_KEY: "test-moonshot-key",
      ZHIPU_API_KEY: "test-zhipu-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
      VISEPANDA_MODEL_CONCIERGE_PRIMARY: "kimi-k2.6",
      VISEPANDA_MODEL_CONCIERGE_FALLBACK: "glm-5.2",
      VISEPANDA_MODEL_CONCIERGE_TERTIARY: "deepseek-v4-pro",
    });

    const result = await runtime.generate("concierge", {
      task: "knowledge_qa",
      prompt: "Answer",
      effort: "medium",
    });

    expect(result).toMatchObject({
      attempts: [
        {
          route: "concierge_primary",
          provider: "moonshot",
          model: "kimi-k2.6",
          costSnapshot: {
            inputTokens: 1_000,
            cachedInputTokens: 250,
            outputTokens: 500,
            inputPricePerMillionUsd: "0.95000000",
            cachedInputPricePerMillionUsd: "0.16000000",
            outputPricePerMillionUsd: "4.00000000",
            costUsd: "0.00275250",
            pricingMissing: false,
          },
        },
      ],
    });
    expect(JSON.stringify(result)).not.toMatch(
      /test-moonshot-key|test-zhipu-key|test-deepseek-key|cookie|signature/i,
    );
  });

  it("preserves billed attempts when router output cannot be parsed", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            model: "catalog-confirmed-qwen",
            choices: [{ message: { content: '{"not_intent":"question"}' } }],
            usage: { prompt_tokens: 25, completion_tokens: 5 },
          }),
          { status: 200 },
        ),
      ),
    );
    const dependencies = createDemoCopilotModelDependencies({
      DASHSCOPE_API_KEY: "test-dashscope-key",
      DEEPSEEK_API_KEY: "test-deepseek-key",
      VISEPANDA_MODEL_ROUTER_PRIMARY: "catalog-confirmed-qwen",
      VISEPANDA_MODEL_ROUTER_FALLBACK: "catalog-confirmed-deepseek",
    });

    await expect(
      dependencies.routeIntent({ message: "Hello", currentTrip: null }),
    ).rejects.toMatchObject({
      name: DemoModelResponseError.name,
      attempts: [
        expect.objectContaining({
          route: "router_primary",
          inputTokens: 25,
          outputTokens: 5,
        }),
      ],
    });
  });
});
