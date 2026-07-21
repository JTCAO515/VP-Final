import type {
  ModelProvider,
  ModelProviderResult,
  ModelPricingProvider,
  RoutedModelRequest,
  TokenUsage,
} from "./index.js";

export type ProviderFailureClass =
  | "configuration_missing"
  | "http_error"
  | "malformed_response"
  | "network_error"
  | "timeout"
  | "total_timeout";

export class ModelProviderError extends Error {
  constructor(readonly failureClass: ProviderFailureClass) {
    super(failureClass);
    this.name = "ModelProviderError";
  }
}

export type OpenAiCompatibleProviderConfig = {
  id: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxTokens: number;
  extraBody?: Record<string, unknown>;
  pricingProvider?: ModelPricingProvider;
  fetchImpl?: typeof fetch;
};

type ProviderSlot = "primary" | "fallback";

export type ProviderConfigurationResolution =
  | { status: "configured"; config: OpenAiCompatibleProviderConfig }
  | { status: "unavailable"; code: "provider_configuration_missing"; slot: ProviderSlot };

export function resolveOpenAiCompatibleProvider(
  environment: Readonly<Record<string, string | undefined>>,
  slot: ProviderSlot,
): ProviderConfigurationResolution {
  const prefix = `VISEPANDA_AI_${slot.toUpperCase()}`;
  const baseUrl = environment[`${prefix}_BASE_URL`];
  const apiKey = environment[`${prefix}_API_KEY`];
  const model = environment[`${prefix}_MODEL`];
  if (!baseUrl || !apiKey || !model) {
    return { status: "unavailable", code: "provider_configuration_missing", slot };
  }

  return {
    status: "configured",
    config: {
      id: slot,
      baseUrl,
      apiKey,
      model,
      timeoutMs: positiveInteger(environment[`${prefix}_TIMEOUT_MS`], 12_000),
      maxTokens: positiveInteger(environment[`${prefix}_MAX_TOKENS`], 1_200),
    },
  };
}

export function createOpenAiCompatibleProvider(
  config: OpenAiCompatibleProviderConfig,
): ModelProvider {
  const provider: ModelProvider = {
    id: config.id,
    model: config.model,
    async generate(request: RoutedModelRequest): Promise<ModelProviderResult> {
      const controller = new AbortController();
      const timeoutMs = Math.min(request.timeoutMs ?? config.timeoutMs, config.timeoutMs);
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await (config.fetchImpl ?? fetch)(
          `${withoutTrailingSlash(config.baseUrl)}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${config.apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...(config.extraBody ?? {}),
              model: config.model,
              messages: [{ role: "user", content: request.prompt }],
              max_tokens: Math.min(request.maxTokens ?? config.maxTokens, config.maxTokens),
              response_format: { type: "json_object" },
            }),
            signal: controller.signal,
          },
        );
        if (!response.ok) throw new ModelProviderError("http_error");
        const parsed = await parseJson(response);
        const result = parseResponse(parsed, config.pricingProvider);
        return {
          content: result.content,
          ...(result.model ? { model: result.model } : {}),
          ...(result.usage ? { usage: result.usage } : {}),
        };
      } catch (error) {
        if (error instanceof ModelProviderError) throw error;
        if (error instanceof DOMException && error.name === "AbortError") {
          throw new ModelProviderError("timeout");
        }
        throw new ModelProviderError("network_error");
      } finally {
        clearTimeout(timeout);
      }
    },
  };
  if (config.pricingProvider) provider.pricingProvider = config.pricingProvider;
  return provider;
}

function parseResponse(
  value: unknown,
  provider: ModelPricingProvider | undefined,
): {
  content: string;
  model?: string;
  usage?: TokenUsage;
} {
  if (!isRecord(value)) throw new ModelProviderError("malformed_response");
  const choices = value.choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  const message = isRecord(first) ? first.message : undefined;
  const content = isRecord(message) ? message.content : undefined;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new ModelProviderError("malformed_response");
  }
  const usage = isRecord(value.usage) ? normalizeUsage(value.usage, provider) : undefined;
  return {
    content,
    ...(typeof value.model === "string" ? { model: value.model } : {}),
    ...(usage ? { usage } : {}),
  };
}

function normalizeUsage(
  usage: Record<string, unknown>,
  provider: ModelPricingProvider | undefined,
): TokenUsage {
  const inputTokens = tokenCountOrZero(usage.prompt_tokens);
  const candidate = cachedInputCandidate(usage, provider);
  const cachedInputTokens = candidate <= inputTokens ? candidate : 0;
  return {
    inputTokens,
    cachedInputTokens,
    outputTokens: tokenCountOrZero(usage.completion_tokens),
  };
}

function cachedInputCandidate(
  usage: Record<string, unknown>,
  provider: ModelPricingProvider | undefined,
): number {
  if (provider === "deepseek") {
    // Field shape is contract-frozen but no sanitized production sample is retained: 未实测，保守取 0.
    return tokenCountOrZero(usage.prompt_cache_hit_tokens);
  }
  if (provider === "dashscope") {
    // Field shape is contract-frozen but no sanitized production sample is retained: 未实测，保守取 0.
    return tokenCountOrZero(promptTokenDetails(usage)?.cached_tokens);
  }
  if (provider === "moonshot") {
    // Field shape is contract-frozen but no sanitized production sample is retained: 未实测，保守取 0.
    return tokenCountOrZero(promptTokenDetails(usage)?.cached_tokens);
  }
  if (provider === "zhipu") {
    // Field shape is contract-frozen but no sanitized production sample is retained: 未实测，保守取 0.
    return tokenCountOrZero(promptTokenDetails(usage)?.cached_tokens);
  }
  return 0;
}

function promptTokenDetails(usage: Record<string, unknown>): Record<string, unknown> | undefined {
  return isRecord(usage.prompt_tokens_details) ? usage.prompt_tokens_details : undefined;
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ModelProviderError("malformed_response");
  }
}

function positiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function tokenCountOrZero(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function withoutTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
