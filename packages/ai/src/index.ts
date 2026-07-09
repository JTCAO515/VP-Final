export type AiTask = "router" | "trip_writer" | "knowledge_qa" | "commerce_human_handoff";
export type ModelEffort = "low" | "medium" | "high";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
};

export type ModelPricing = {
  inputUsdPerMillionTokens: number;
  outputUsdPerMillionTokens: number;
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
};

export type ModelProviderResult = {
  content: string;
  model?: string;
  usage?: TokenUsage;
};

export type ModelProvider = {
  id: string;
  model: string;
  pricing?: ModelPricing;
  generate(request: RoutedModelRequest): Promise<ModelProviderResult>;
};

export type ModelAttempt = {
  provider: string;
  ok: boolean;
  error?: string;
};

export type ModelRunLedgerEntry = {
  task: AiTask;
  provider: string;
  model: string;
  effort: ModelEffort;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export type ModelRouterResponse = {
  provider: string;
  model: string;
  content: string;
  effort: ModelEffort;
  usage: TokenUsage;
  costUsd: number;
  attempts: ModelAttempt[];
};

export type CostLedger = {
  record(entry: ModelRunLedgerEntry): void;
  entries(): ModelRunLedgerEntry[];
};

export type ModelRouterOptions = {
  providers: ModelProvider[];
  ledger?: CostLedger;
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
}: ModelRouterOptions) {
  if (providers.length === 0) {
    throw new Error("At least one model provider is required");
  }

  return {
    ledger,
    async generate(request: ModelRequest): Promise<ModelRouterResponse> {
      const effort = request.effort ?? "medium";
      const routedRequest: RoutedModelRequest = { ...request, effort };
      const attempts: ModelAttempt[] = [];

      for (const provider of providers) {
        try {
          const result = await provider.generate(routedRequest);
          const usage = result.usage ?? { inputTokens: 0, outputTokens: 0 };
          const model = result.model ?? provider.model;
          const costUsd = calculateCostUsd(usage, provider.pricing);
          const entry = {
            task: request.task,
            provider: provider.id,
            model,
            effort,
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            costUsd,
          };

          attempts.push({ provider: provider.id, ok: true });
          ledger.record(entry);

          return {
            provider: provider.id,
            model,
            content: result.content,
            effort,
            usage,
            costUsd,
            attempts,
          };
        } catch (error) {
          attempts.push({
            provider: provider.id,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      throw new ModelRoutingError(attempts);
    },
  };
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

export function calculateCostUsd(usage: TokenUsage, pricing?: ModelPricing): number {
  if (!pricing) return 0;

  return (
    (usage.inputTokens / 1_000_000) * pricing.inputUsdPerMillionTokens +
    (usage.outputTokens / 1_000_000) * pricing.outputUsdPerMillionTokens
  );
}

export function createStaticProvider(options: {
  id: string;
  model: string;
  content?: string;
  usage?: TokenUsage;
  pricing?: ModelPricing;
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
  if (options.pricing) provider.pricing = options.pricing;

  return provider;
}
