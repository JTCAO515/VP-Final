import { describe, expect, it } from "vitest";

import { calculateSpeechCost, getSpeechPriceSnapshot } from "./pricing.js";

describe("experimental speech pricing snapshots", () => {
  it("snapshots current Paraformer per-second pricing with fixed-point calculation", () => {
    const price = getSpeechPriceSnapshot("dashscope", "paraformer-realtime-v2", "cn-beijing");
    expect(calculateSpeechCost(12.5, price)).toEqual({
      usageUnits: 12.5,
      estimatedCost: "0.00300000",
      pricing: price,
    });
  });

  it("snapshots current CosyVoice per-character pricing", () => {
    const price = getSpeechPriceSnapshot("dashscope", "cosyvoice-v3.5-flash", "cn-beijing");
    expect(calculateSpeechCost(125, price).estimatedCost).toBe("0.01000000");
  });

  it("refuses to estimate cost for an unregistered model", () => {
    expect(() => getSpeechPriceSnapshot("dashscope", "future-model", "cn-beijing")).toThrow(
      "SPEECH_PRICE_NOT_REGISTERED",
    );
  });
});
