import { describe, expect, it } from "vitest";
import {
  MODEL_PRICING_REGISTRY,
  resolveModelPricing,
  validateModelPricingRegistry,
} from "./pricingRegistry.js";

describe("model pricing registry", () => {
  it("contains unique provider/model keys with auditable USD snapshots", () => {
    expect(() => validateModelPricingRegistry(MODEL_PRICING_REGISTRY)).not.toThrow();

    for (const entry of MODEL_PRICING_REGISTRY) {
      expect(entry.currency).toBe("USD");
      expect(entry.sourceUrl).toMatch(/^https:\/\//);
      expect(Date.parse(entry.effectiveFrom)).not.toBeNaN();
      expect(Date.parse(entry.retrievedAt)).not.toBeNaN();
    }
  });

  it("resolves exact configured model ids and never guesses aliases", () => {
    expect(resolveModelPricing("moonshot", "kimi-k2.6")).toMatchObject({
      inputMissPerMillionUsd: "0.95000000",
      inputHitPerMillionUsd: "0.16000000",
      outputPerMillionUsd: "4.00000000",
      sourceUrl: "https://platform.kimi.ai/docs/pricing/chat-k26",
    });
    expect(resolveModelPricing("deepseek", "deepseek-v4-pro")).toMatchObject({
      inputMissPerMillionUsd: "0.43500000",
      inputHitPerMillionUsd: "0.00362500",
      outputPerMillionUsd: "0.87000000",
    });
    expect(resolveModelPricing("deepseek", "deepseek-chat")).toBeNull();
    expect(resolveModelPricing("zhipu", "unregistered-model")).toBeNull();
  });

  it("rejects duplicate keys", () => {
    const first = MODEL_PRICING_REGISTRY[0];
    if (!first) throw new Error("Expected at least one pricing registry entry");
    expect(() => validateModelPricingRegistry([first, first])).toThrow(
      "Duplicate model pricing key",
    );
  });
});
