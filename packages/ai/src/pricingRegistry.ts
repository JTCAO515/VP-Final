import { assertUsdPerMillion } from "./costAccounting.js";

export type ModelPricingProvider = "dashscope" | "deepseek" | "moonshot" | "zhipu";

export type ModelPricingRegistryEntry = Readonly<{
  provider: ModelPricingProvider;
  model: string;
  inputMissPerMillionUsd: string;
  inputHitPerMillionUsd: string;
  outputPerMillionUsd: string;
  currency: "USD";
  effectiveFrom: string;
  sourceUrl: string;
  retrievedAt: string;
}>;

const RETRIEVED_AT = "2026-07-21T03:18:58.000Z";

export const MODEL_PRICING_REGISTRY: readonly ModelPricingRegistryEntry[] = Object.freeze([
  Object.freeze({
    provider: "moonshot",
    model: "kimi-k2.6",
    inputMissPerMillionUsd: "0.95000000",
    inputHitPerMillionUsd: "0.16000000",
    outputPerMillionUsd: "4.00000000",
    currency: "USD",
    effectiveFrom: RETRIEVED_AT,
    sourceUrl: "https://platform.moonshot.ai/docs/pricing/chat-k26",
    retrievedAt: RETRIEVED_AT,
  }),
  Object.freeze({
    provider: "deepseek",
    model: "deepseek-v4-flash",
    inputMissPerMillionUsd: "0.14000000",
    inputHitPerMillionUsd: "0.00280000",
    outputPerMillionUsd: "0.28000000",
    currency: "USD",
    effectiveFrom: RETRIEVED_AT,
    sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing/",
    retrievedAt: RETRIEVED_AT,
  }),
  Object.freeze({
    provider: "deepseek",
    model: "deepseek-v4-pro",
    inputMissPerMillionUsd: "0.43500000",
    inputHitPerMillionUsd: "0.00362500",
    outputPerMillionUsd: "0.87000000",
    currency: "USD",
    effectiveFrom: RETRIEVED_AT,
    sourceUrl: "https://api-docs.deepseek.com/quick_start/pricing/",
    retrievedAt: RETRIEVED_AT,
  }),
]);

validateModelPricingRegistry(MODEL_PRICING_REGISTRY);

export function resolveModelPricing(
  provider: string,
  model: string,
): ModelPricingRegistryEntry | null {
  return (
    MODEL_PRICING_REGISTRY.find((entry) => entry.provider === provider && entry.model === model) ??
    null
  );
}

export function validateModelPricingRegistry(entries: readonly ModelPricingRegistryEntry[]): void {
  const keys = new Set<string>();
  for (const entry of entries) {
    const key = `${entry.provider}:${entry.model}`;
    if (keys.has(key)) throw new Error(`Duplicate model pricing key: ${key}`);
    keys.add(key);

    if (!entry.model.trim()) throw new Error("Model pricing requires a model id");
    assertUsdPerMillion(entry.inputMissPerMillionUsd);
    assertUsdPerMillion(entry.inputHitPerMillionUsd);
    assertUsdPerMillion(entry.outputPerMillionUsd);
    if (entry.currency !== "USD") throw new Error("Model pricing currency must be USD");
    if (!isIsoDate(entry.effectiveFrom) || !isIsoDate(entry.retrievedAt)) {
      throw new Error(`Model pricing dates are invalid: ${key}`);
    }
    const source = new URL(entry.sourceUrl);
    if (source.protocol !== "https:")
      throw new Error(`Model pricing source must use HTTPS: ${key}`);
  }
}

function isIsoDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}
