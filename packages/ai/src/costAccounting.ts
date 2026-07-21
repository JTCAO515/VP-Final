const PRICE_SCALE = 100_000_000n;
const TOKENS_PER_MILLION = 1_000_000n;
const MAX_NUMERIC_14_8_SCALED = 99_999_999_999_999n;

export type LlmCostCalculationInput = {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  inputMissPerMillionUsd: string;
  inputHitPerMillionUsd: string;
  outputPerMillionUsd: string;
};

export type LlmCostCalculation = {
  uncachedInputTokens: number;
  costUsd: string;
};

export function calculateLlmCostUsd(input: LlmCostCalculationInput): LlmCostCalculation {
  const inputTokens = parseTokenCount(input.inputTokens, "inputTokens");
  const cachedInputTokens = parseTokenCount(input.cachedInputTokens, "cachedInputTokens");
  const outputTokens = parseTokenCount(input.outputTokens, "outputTokens");
  if (cachedInputTokens > inputTokens) {
    throw new Error("cachedInputTokens must not exceed inputTokens");
  }

  const inputMissPrice = parseUsdPerMillion(input.inputMissPerMillionUsd);
  const inputHitPrice = parseUsdPerMillion(input.inputHitPerMillionUsd);
  const outputPrice = parseUsdPerMillion(input.outputPerMillionUsd);
  const uncachedInputTokens = inputTokens - cachedInputTokens;

  const scaledCostNumerator =
    uncachedInputTokens * inputMissPrice +
    cachedInputTokens * inputHitPrice +
    outputTokens * outputPrice;
  const scaledCost = (scaledCostNumerator + TOKENS_PER_MILLION / 2n) / TOKENS_PER_MILLION;
  if (scaledCost > MAX_NUMERIC_14_8_SCALED) {
    throw new Error("Calculated cost exceeds numeric(14,8)");
  }

  return {
    uncachedInputTokens: Number(uncachedInputTokens),
    costUsd: formatScaledUsd(scaledCost),
  };
}

export function assertUsdPerMillion(value: string): void {
  parseUsdPerMillion(value);
}

function parseTokenCount(value: number, field: string): bigint {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${field} must be a nonnegative safe integer`);
  }
  return BigInt(value);
}

function parseUsdPerMillion(value: string): bigint {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) {
    throw new Error("USD price must be a nonnegative decimal string");
  }
  const fractional = match[2] ?? "";
  if (fractional.length > 8) {
    throw new Error("USD price must have at most eight decimal places");
  }
  const scaled = BigInt(match[1]!) * PRICE_SCALE + BigInt(fractional.padEnd(8, "0") || "0");
  if (scaled > MAX_NUMERIC_14_8_SCALED) {
    throw new Error("USD price exceeds numeric(14,8)");
  }
  return scaled;
}

function formatScaledUsd(value: bigint): string {
  const whole = value / PRICE_SCALE;
  const fractional = (value % PRICE_SCALE).toString().padStart(8, "0");
  return `${whole}.${fractional}`;
}
