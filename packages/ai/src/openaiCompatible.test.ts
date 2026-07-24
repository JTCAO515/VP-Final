import { describe, expect, it, vi } from "vitest";
import {
  createOpenAiCompatibleProvider,
  ModelProviderError,
  resolveOpenAiCompatibleProvider,
} from "./openaiCompatible.js";

describe("OpenAI-compatible provider", () => {
  it("sends a bounded structured JSON request and parses usage", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          model: "response-model",
          choices: [{ message: { content: '{"intent":"chat_only"}' } }],
          usage: { prompt_tokens: 12, completion_tokens: 34 },
        }),
        { status: 200 },
      ),
    );
    const provider = createOpenAiCompatibleProvider({
      id: "primary",
      pricingProvider: "deepseek",
      baseUrl: "https://provider.example/v1/",
      apiKey: "test-key",
      model: "configured-model",
      timeoutMs: 1_000,
      maxTokens: 100,
      fetchImpl,
    });

    await expect(
      provider.generate({ task: "trip_writer", prompt: "Plan", effort: "medium", maxTokens: 200 }),
    ).resolves.toEqual({
      content: '{"intent":"chat_only"}',
      model: "response-model",
      usage: { inputTokens: 12, cachedInputTokens: 0, outputTokens: 34 },
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      "https://provider.example/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
        body: JSON.stringify({
          model: "configured-model",
          messages: [{ role: "user", content: "Plan" }],
          max_tokens: 100,
          response_format: { type: "json_object" },
        }),
      }),
    );
  });

  it.each([
    {
      provider: "deepseek" as const,
      expectedCachedInputTokens: 40,
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_cache_hit_tokens: 40,
        prompt_cache_miss_tokens: 60,
      },
      source: "DeepSeek contract field usage.prompt_cache_hit_tokens",
    },
    {
      provider: "dashscope" as const,
      expectedCachedInputTokens: 30,
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 30 },
      },
      source: "DashScope contract field usage.prompt_tokens_details.cached_tokens",
    },
    {
      provider: "moonshot" as const,
      expectedCachedInputTokens: 25,
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 25 },
      },
      source: "Moonshot contract field usage.prompt_tokens_details.cached_tokens",
    },
    {
      provider: "zhipu" as const,
      expectedCachedInputTokens: 15,
      usage: {
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 15 },
      },
      source: "Zhipu contract field usage.prompt_tokens_details.cached_tokens",
    },
  ])(
    "normalizes $provider cached usage from $source",
    async ({ provider, expectedCachedInputTokens, usage }) => {
      const adapter = createOpenAiCompatibleProvider({
        id: `${provider}-route`,
        pricingProvider: provider,
        baseUrl: "https://provider.example/v1",
        apiKey: "test-key",
        model: "configured-model",
        timeoutMs: 1_000,
        maxTokens: 100,
        fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"intent":"chat_only"}' } }],
              usage,
            }),
            { status: 200 },
          ),
        ),
      });

      await expect(
        adapter.generate({ task: "router", prompt: "Classify", effort: "low" }),
      ).resolves.toMatchObject({
        usage: {
          inputTokens: 100,
          cachedInputTokens: expectedCachedInputTokens,
          outputTokens: 20,
        },
      });
    },
  );

  it("uses conservative zero when cached usage is absent or invalid", async () => {
    const responses = [
      { prompt_tokens: 100, completion_tokens: 20 },
      {
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: 101 },
      },
      {
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: -1 },
      },
      {
        prompt_tokens: 100,
        completion_tokens: 20,
        prompt_tokens_details: { cached_tokens: "25" },
      },
    ];
    const fetchImpl = vi.fn<typeof fetch>();
    for (const usage of responses) {
      fetchImpl.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: '{"intent":"chat_only"}' } }],
            usage,
          }),
          { status: 200 },
        ),
      );
    }
    const adapter = createOpenAiCompatibleProvider({
      id: "dashscope-route",
      pricingProvider: "dashscope",
      baseUrl: "https://provider.example/v1",
      apiKey: "test-key",
      model: "configured-model",
      timeoutMs: 1_000,
      maxTokens: 100,
      fetchImpl,
    });

    for (const expected of responses) {
      await expect(
        adapter.generate({ task: "router", prompt: "Classify", effort: "low" }),
      ).resolves.toMatchObject({
        usage: { inputTokens: expected.prompt_tokens, cachedInputTokens: 0, outputTokens: 20 },
      });
    }
  });

  it("merges provider-specific body fields without overriding the core request", async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: '{"intent":"chat_only"}' } }],
        }),
        { status: 200 },
      ),
    );
    const provider = createOpenAiCompatibleProvider({
      id: "primary",
      baseUrl: "https://provider.example/v1",
      apiKey: "test-key",
      model: "configured-model",
      timeoutMs: 1_000,
      maxTokens: 100,
      extraBody: {
        thinking: { type: "disabled" },
        model: "should-not-win",
        response_format: { type: "text" },
      },
      fetchImpl,
    });

    await provider.generate({ task: "router", prompt: "Classify", effort: "low" });

    const [, init] = fetchImpl.mock.calls[0] ?? [];
    expect(JSON.parse(String(init?.body))).toEqual({
      thinking: { type: "disabled" },
      model: "configured-model",
      messages: [{ role: "user", content: "Classify" }],
      max_tokens: 100,
      response_format: { type: "json_object" },
    });
  });

  it("normalizes HTTP and malformed responses without preserving provider text", async () => {
    const httpProvider = createOpenAiCompatibleProvider({
      id: "primary",
      baseUrl: "https://provider.example",
      apiKey: "test-key",
      model: "model",
      timeoutMs: 1_000,
      maxTokens: 100,
      fetchImpl: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("secret upstream error", { status: 429 })),
    });
    await expect(
      httpProvider.generate({ task: "router", prompt: "Classify", effort: "low" }),
    ).rejects.toEqual(expect.objectContaining({ failureClass: "http_error" }));

    const malformedProvider = createOpenAiCompatibleProvider({
      id: "primary",
      baseUrl: "https://provider.example",
      apiKey: "test-key",
      model: "model",
      timeoutMs: 1_000,
      maxTokens: 100,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response("{}", { status: 200 })),
    });
    await expect(
      malformedProvider.generate({ task: "router", prompt: "Classify", effort: "low" }),
    ).rejects.toMatchObject({ name: ModelProviderError.name, failureClass: "malformed_response" });

    const nonJsonProvider = createOpenAiCompatibleProvider({
      id: "primary",
      baseUrl: "https://provider.example",
      apiKey: "test-key",
      model: "model",
      timeoutMs: 1_000,
      maxTokens: 100,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(new Response("not json", { status: 200 })),
    });
    await expect(
      nonJsonProvider.generate({ task: "router", prompt: "Classify", effort: "low" }),
    ).rejects.toMatchObject({ name: ModelProviderError.name, failureClass: "malformed_response" });

    const timeoutProvider = createOpenAiCompatibleProvider({
      id: "primary",
      baseUrl: "https://provider.example",
      apiKey: "test-key",
      model: "model",
      timeoutMs: 1_000,
      maxTokens: 100,
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new DOMException("Aborted", "AbortError")),
    });
    await expect(
      timeoutProvider.generate({ task: "router", prompt: "Classify", effort: "low" }),
    ).rejects.toEqual(expect.objectContaining({ failureClass: "timeout" }));
  });

  it("retains provider-reported usage on failed HTTP and malformed-content responses", async () => {
    const httpProvider = createOpenAiCompatibleProvider({
      id: "primary",
      pricingProvider: "moonshot",
      baseUrl: "https://provider.example",
      apiKey: "test-key",
      model: "configured-model",
      timeoutMs: 1_000,
      maxTokens: 100,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            model: "billed-model",
            usage: {
              prompt_tokens: 80,
              completion_tokens: 4,
              prompt_tokens_details: { cached_tokens: 20 },
            },
            error: { message: "must never escape" },
          }),
          { status: 429 },
        ),
      ),
    });
    await expect(
      httpProvider.generate({ task: "router", prompt: "Classify", effort: "low" }),
    ).rejects.toMatchObject({
      failureClass: "http_error",
      model: "billed-model",
      usage: { inputTokens: 80, cachedInputTokens: 20, outputTokens: 4 },
    });

    const malformedProvider = createOpenAiCompatibleProvider({
      id: "primary",
      pricingProvider: "deepseek",
      baseUrl: "https://provider.example",
      apiKey: "test-key",
      model: "configured-model",
      timeoutMs: 1_000,
      maxTokens: 100,
      fetchImpl: vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            model: "deepseek-v4-pro",
            choices: [{ message: { content: "" } }],
            usage: {
              prompt_tokens: 100,
              completion_tokens: 7,
              prompt_cache_hit_tokens: 25,
            },
          }),
          { status: 200 },
        ),
      ),
    });
    await expect(
      malformedProvider.generate({ task: "trip_writer", prompt: "Plan", effort: "high" }),
    ).rejects.toMatchObject({
      failureClass: "malformed_response",
      model: "deepseek-v4-pro",
      usage: { inputTokens: 100, cachedInputTokens: 25, outputTokens: 7 },
    });
  });

  it("uses the provider timeout as the per-attempt cap", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>(
        (_input, init) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
              reject(new DOMException("Aborted", "AbortError"));
            });
          }),
      );
      const provider = createOpenAiCompatibleProvider({
        id: "primary",
        baseUrl: "https://provider.example",
        apiKey: "test-key",
        model: "model",
        timeoutMs: 1_000,
        maxTokens: 100,
        fetchImpl,
      });

      const result = provider.generate({
        task: "router",
        prompt: "Classify",
        effort: "low",
        timeoutMs: 25_000,
      });

      await vi.advanceTimersByTimeAsync(999);
      await expect(Promise.race([result, Promise.resolve("pending")])).resolves.toBe("pending");
      await vi.advanceTimersByTimeAsync(1);
      await expect(result).rejects.toEqual(expect.objectContaining({ failureClass: "timeout" }));
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("provider configuration", () => {
  it("returns a safe unavailable result when a provider is incomplete", () => {
    expect(resolveOpenAiCompatibleProvider({}, "primary")).toEqual({
      status: "unavailable",
      code: "provider_configuration_missing",
      slot: "primary",
    });
  });

  it("resolves only configured values and bounded numeric options", () => {
    const result = resolveOpenAiCompatibleProvider(
      {
        VISEPANDA_AI_PRIMARY_BASE_URL: "https://provider.example/v1",
        VISEPANDA_AI_PRIMARY_API_KEY: "test-key",
        VISEPANDA_AI_PRIMARY_MODEL: "test-model",
        VISEPANDA_AI_PRIMARY_TIMEOUT_MS: "invalid",
        VISEPANDA_AI_PRIMARY_MAX_TOKENS: "400",
      },
      "primary",
    );
    expect(result).toEqual({
      status: "configured",
      config: expect.objectContaining({ id: "primary", timeoutMs: 12_000, maxTokens: 400 }),
    });
  });
});
