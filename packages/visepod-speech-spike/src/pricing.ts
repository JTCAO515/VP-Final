import type { SpeechCostSnapshot, SpeechPriceSnapshot } from "./types.js";

const PRICE_SCALE = 100_000_000n;
const USAGE_SCALE = 1_000_000n;

const OFFICIAL_PRICING_URL = "https://help.aliyun.com/en/model-studio/model-pricing";

export const speechPriceRegistry: readonly SpeechPriceSnapshot[] = [
  {
    provider: "dashscope",
    model: "paraformer-realtime-v2",
    region: "cn-beijing",
    meter: "audio_second",
    currency: "CNY",
    unitPrice: "0.00024000",
    unitsPerPrice: 1,
    sourceUrl: OFFICIAL_PRICING_URL,
    retrievedAt: "2026-07-27",
  },
  {
    provider: "dashscope",
    model: "cosyvoice-v3.5-flash",
    region: "cn-beijing",
    meter: "character",
    currency: "CNY",
    unitPrice: "0.80000000",
    unitsPerPrice: 10_000,
    sourceUrl: OFFICIAL_PRICING_URL,
    retrievedAt: "2026-07-27",
  },
];

function parseFixedPrice(value: string): bigint {
  if (!/^\d+(?:\.\d{1,8})?$/.test(value)) {
    throw new Error("Speech price must be a nonnegative decimal with at most 8 decimals");
  }
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * PRICE_SCALE + BigInt(fraction.padEnd(8, "0"));
}

function formatFixedPrice(value: bigint): string {
  const whole = value / PRICE_SCALE;
  const fraction = (value % PRICE_SCALE).toString().padStart(8, "0");
  return `${whole}.${fraction}`;
}

export function getSpeechPriceSnapshot(
  provider: string,
  model: string,
  region: string,
): SpeechPriceSnapshot {
  const price = speechPriceRegistry.find(
    (candidate) =>
      candidate.provider === provider && candidate.model === model && candidate.region === region,
  );
  if (!price) {
    throw new Error(`SPEECH_PRICE_NOT_REGISTERED:${provider}/${model}/${region}`);
  }
  return price;
}

export function calculateSpeechCost(
  usageUnits: number,
  pricing: SpeechPriceSnapshot,
): SpeechCostSnapshot {
  if (!Number.isFinite(usageUnits) || usageUnits < 0 || pricing.unitsPerPrice <= 0) {
    throw new Error("Speech usage and pricing unit must be nonnegative finite values");
  }

  const scaledUsage = BigInt(Math.round(usageUnits * Number(USAGE_SCALE)));
  const scaledPrice = parseFixedPrice(pricing.unitPrice);
  const denominator = USAGE_SCALE * BigInt(pricing.unitsPerPrice);
  const scaledCost = (scaledUsage * scaledPrice + denominator / 2n) / denominator;

  return {
    usageUnits,
    estimatedCost: formatFixedPrice(scaledCost),
    pricing,
  };
}
