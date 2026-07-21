import { calculateLlmCostUsd } from "./costAccounting.js";
import { resolveModelPricing, type ModelPricingProvider } from "./pricingRegistry.js";

export type AiTask = "router" | "trip_writer" | "knowledge_qa" | "commerce_human_handoff";
export type ModelEffort = "low" | "medium" | "high";

export type TokenUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
};

export type ModelRequest = {
  task: AiTask;
  prompt: string;
  effort?: ModelEffort;
  maxTokens?: number;
  metadata?: Record<string, unknown>;
};

export type RoutedModelRequest = ModelRequest & {
  effort: ModelEffort;
  timeoutMs?: number;
};

export type ModelProviderResult = {
  content: string;
  model?: string;
  usage?: TokenUsage;
};

export type ModelProvider = {
  id: string;
  model: string;
  pricingProvider?: ModelPricingProvider;
  generate(request: RoutedModelRequest): Promise<ModelProviderResult>;
};

export type ModelAttemptCostSnapshot = {
  provider: string;
  model: string;
  effort: ModelEffort;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  inputPricePerMillionUsd: string;
  cachedInputPricePerMillionUsd: string;
  outputPricePerMillionUsd: string;
  costUsd: string;
  pricingMissing: boolean;
  fallbackTriggered: boolean;
};

export type ModelAttempt = {
  route: string;
  provider: string;
  model: string;
  ok: boolean;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  costSnapshot: ModelAttemptCostSnapshot;
  failureClass?: import("./openaiCompatible.js").ProviderFailureClass;
};

export type ModelRunLedgerEntry = {
  task: AiTask;
  route: string;
  provider: string;
  model: string;
  effort: ModelEffort;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  costUsd: number;
  costSnapshot: ModelAttemptCostSnapshot;
};

export type ModelRouterResponse = {
  route: string;
  provider: string;
  model: string;
  content: string;
  effort: ModelEffort;
  usage: TokenUsage;
  costUsd: number;
  costSnapshot: ModelAttemptCostSnapshot;
  attempts: ModelAttempt[];
};

export type CostLedger = {
  record(entry: ModelRunLedgerEntry): void;
  entries(): ModelRunLedgerEntry[];
};

export type ModelRouterOptions = {
  providers: ModelProvider[];
  ledger?: CostLedger;
  totalTimeoutMs?: number;
};

export class ModelRoutingError extends Error {
  constructor(readonly attempts: ModelAttempt[]) {
    super("All model providers failed");
    this.name = "ModelRoutingError";
  }
}

export function createModelRouter({
  providers,
  ledger = createInMemoryCostLedger(),
  totalTimeoutMs = 25_000,
}: ModelRouterOptions) {
  if (providers.length === 0) {
    throw new Error("At least one model provider is required");
  }

  return {
    ledger,
    async generate(request: ModelRequest): Promise<ModelRouterResponse> {
      const startedAt = Date.now();
      const effort = request.effort ?? "medium";
      const routedRequest: RoutedModelRequest = { ...request, effort };
      const attempts: ModelAttempt[] = [];

      for (const [attemptIndex, provider] of providers.entries()) {
        const providerName = provider.pricingProvider ?? provider.id;
        const fallbackTriggered = attemptIndex > 0;
        const remainingMs = totalTimeoutMs - (Date.now() - startedAt);
        if (remainingMs <= 0) {
          const costSnapshot = createAttemptCostSnapshot({
            provider: providerName,
            model: provider.model,
            effort,
            usage: zeroUsage(),
            fallbackTriggered,
          });
          attempts.push({
            route: provider.id,
            provider: providerName,
            model: provider.model,
            ok: false,
            latencyMs: 0,
            inputTokens: 0,
            outputTokens: 0,
            costUsd: 0,
            costSnapshot,
            failureClass: "total_timeout",
          });
          break;
        }
        const attemptStartedAt = Date.now();
        try {
          const result = await provider.generate({ ...routedRequest, timeoutMs: remainingMs });
          const usage = result.usage ?? zeroUsage();
          const model = result.model ?? provider.model;
          const costSnapshot = createAttemptCostSnapshot({
            provider: providerName,
            model,
            effort,
            usage,
            fallbackTriggered,
          });
          const costUsd = Number(costSnapshot.costUsd);
          const entry = {
            task: request.task,
            route: provider.id,
            provider: providerName,
            model,
            effort,
            inputTokens: usage.inputTokens,
            cachedInputTokens: usage.cachedInputTokens,
            outputTokens: usage.outputTokens,
            costUsd,
            costSnapshot,
          };

          attempts.push({
            route: provider.id,
            provider: providerName,
            model,
            ok: true,
            latencyMs: Date.now() - attemptStartedAt,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            costUsd,
            costSnapshot,
          });
          ledger.record(entry);

          return {
            route: provider.id,
            provider: providerName,
            model,
            content: result.content,
            effort,
            usage,
            costUsd,
            costSnapshot,
            attempts,
          };
        } catch (error) {
          const failedUsage = providerFailureUsage(error) ?? zeroUsage();
          const failedModel = providerFailureModel(error) ?? provider.model;
          const costSnapshot = createAttemptCostSnapshot({
            provider: providerName,
            model: failedModel,
            effort,
            usage: failedUsage,
            fallbackTriggered,
          });
          attempts.push({
            route: provider.id,
            provider: providerName,
            model: failedModel,
            ok: false,
            latencyMs: Date.now() - attemptStartedAt,
            inputTokens: failedUsage.inputTokens,
            outputTokens: failedUsage.outputTokens,
            costUsd: Number(costSnapshot.costUsd),
            costSnapshot,
            failureClass: normalizeFailureClass(error),
          });
        }
      }

      throw new ModelRoutingError(attempts);
    },
  };
}

function normalizeFailureClass(
  error: unknown,
): import("./openaiCompatible.js").ProviderFailureClass {
  if (isProviderFailure(error)) return error.failureClass;
  return "network_error";
}

function isProviderFailure(error: unknown): error is {
  failureClass: import("./openaiCompatible.js").ProviderFailureClass;
  usage?: TokenUsage;
  model?: string;
} {
  return typeof error === "object" && error !== null && "failureClass" in error;
}

function providerFailureUsage(error: unknown): TokenUsage | undefined {
  return isProviderFailure(error) ? error.usage : undefined;
}

function providerFailureModel(error: unknown): string | undefined {
  return isProviderFailure(error) ? error.model : undefined;
}

export function createInMemoryCostLedger(seed: ModelRunLedgerEntry[] = []): CostLedger {
  const records = [...seed];

  return {
    record(entry) {
      records.push(entry);
    },
    entries() {
      return [...records];
    },
  };
}

export function createStaticProvider(options: {
  id: string;
  pricingProvider?: ModelPricingProvider;
  model: string;
  content?: string;
  usage?: TokenUsage;
  failWith?: string;
  onGenerate?: (request: RoutedModelRequest) => void;
}): ModelProvider {
  const provider: ModelProvider = {
    id: options.id,
    model: options.model,
    async generate(request) {
      options.onGenerate?.(request);
      if (options.failWith) {
        throw new Error(options.failWith);
      }

      const result: ModelProviderResult = {
        content: options.content ?? "ok",
        model: options.model,
      };
      if (options.usage) result.usage = options.usage;

      return result;
    },
  };
  if (options.pricingProvider) provider.pricingProvider = options.pricingProvider;

  return provider;
}

function createAttemptCostSnapshot(input: {
  provider: string;
  model: string;
  effort: ModelEffort;
  usage: TokenUsage;
  fallbackTriggered: boolean;
}): ModelAttemptCostSnapshot {
  const pricing = resolveModelPricing(input.provider, input.model);
  const inputPricePerMillionUsd = pricing?.inputMissPerMillionUsd ?? "0";
  const cachedInputPricePerMillionUsd = pricing?.inputHitPerMillionUsd ?? "0";
  const outputPricePerMillionUsd = pricing?.outputPerMillionUsd ?? "0";
  const calculation = calculateLlmCostUsd({
    inputTokens: input.usage.inputTokens,
    cachedInputTokens: input.usage.cachedInputTokens,
    outputTokens: input.usage.outputTokens,
    inputMissPerMillionUsd: inputPricePerMillionUsd,
    inputHitPerMillionUsd: cachedInputPricePerMillionUsd,
    outputPerMillionUsd: outputPricePerMillionUsd,
  });

  return {
    provider: input.provider,
    model: input.model,
    effort: input.effort,
    inputTokens: input.usage.inputTokens,
    cachedInputTokens: input.usage.cachedInputTokens,
    outputTokens: input.usage.outputTokens,
    inputPricePerMillionUsd,
    cachedInputPricePerMillionUsd,
    outputPricePerMillionUsd,
    costUsd: calculation.costUsd,
    pricingMissing: pricing === null,
    fallbackTriggered: input.fallbackTriggered,
  };
}

function zeroUsage(): TokenUsage {
  return { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };
}

export {
  createOpenAiCompatibleProvider,
  ModelProviderError,
  resolveOpenAiCompatibleProvider,
} from "./openaiCompatible.js";
export {
  DEMO_MODEL_ROUTES,
  inspectDemoProviderReadiness,
  planningRewriteEnabled,
  resolveDemoModelRoute,
} from "./providerInventory.js";
export type {
  OpenAiCompatibleProviderConfig,
  ProviderConfigurationResolution,
  ProviderFailureClass,
} from "./openaiCompatible.js";
export type {
  DemoModelRoute,
  DemoModelRouteConfig,
  ProviderReadiness,
} from "./providerInventory.js";
export { assertUsdPerMillion, calculateLlmCostUsd } from "./costAccounting.js";
export type { LlmCostCalculation, LlmCostCalculationInput } from "./costAccounting.js";
export {
  MODEL_PRICING_REGISTRY,
  resolveModelPricing,
  validateModelPricingRegistry,
} from "./pricingRegistry.js";
export type { ModelPricingProvider, ModelPricingRegistryEntry } from "./pricingRegistry.js";
