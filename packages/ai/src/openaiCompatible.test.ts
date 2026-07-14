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
      usage: { inputTokens: 12, outputTokens: 34 },
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
