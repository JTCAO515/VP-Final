import { describe, expect, it } from "vitest";

import {
  characterErrorRate,
  hashFixtureManifest,
  percentile,
  summarizeObservations,
} from "./metrics.js";
import { speechBenchmarkSamples, validateSpeechBenchmarkSamples } from "./sampleManifest.js";

describe("speech benchmark metrics", () => {
  it("keeps a fixed 20-sample manifest", () => {
    expect(() => validateSpeechBenchmarkSamples(speechBenchmarkSamples)).not.toThrow();
    expect(speechBenchmarkSamples).toHaveLength(20);
    expect(hashFixtureManifest(speechBenchmarkSamples)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("normalizes punctuation and computes character error rate", () => {
    expect(characterErrorRate("请带我去北京。", "请带我去北京")).toBe(0);
    expect(characterErrorRate("metro", "metra")).toBeCloseTo(0.2);
  });

  it("computes interpolated p50/p95 without counting failed rounds as latency", () => {
    expect(percentile([100, 200, 300, 400], 0.5)).toBe(250);
    expect(
      summarizeObservations([
        {
          sampleId: "a",
          provider: "dashscope",
          sttModel: "stt",
          ttsModel: "tts",
          networkProfile: "wifi_good",
          uploadMode: "buffer_on_commit",
          providerEvidence: "real_provider",
          networkEvidence: "local_baseline",
          status: "succeeded",
          totalRoundMs: 100,
          characterErrorRate: 0,
        },
        {
          sampleId: "b",
          provider: "dashscope",
          sttModel: "stt",
          ttsModel: "tts",
          networkProfile: "wifi_good",
          uploadMode: "buffer_on_commit",
          providerEvidence: "real_provider",
          networkEvidence: "local_baseline",
          status: "failed",
          totalRoundMs: 9_999,
        },
      ]),
    ).toEqual({
      count: 2,
      succeeded: 1,
      failed: 1,
      p50Ms: 100,
      p95Ms: 100,
      meanCharacterErrorRate: 0,
    });
  });
});
