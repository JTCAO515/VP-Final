export type BenchmarkLocale = "en" | "zh" | "mixed";

export type BenchmarkCategory =
  | "first_timer"
  | "payment"
  | "transport"
  | "food_safety"
  | "place_name"
  | "hotel_name"
  | "numbers"
  | "recovery";

export interface SpeechBenchmarkSample {
  id: string;
  locale: BenchmarkLocale;
  category: BenchmarkCategory;
  expectedText: string;
  audioFile: string;
}

export type UploadMode = "buffer_on_commit" | "upstream_streaming";

export interface NetworkProfile {
  id: string;
  chunkDelayMs: number;
  jitterMs: number;
  packetLossPercent: number;
  disconnectAfterChunk?: number;
}

export interface SpeechPriceSnapshot {
  provider: string;
  model: string;
  region: string;
  meter: "audio_second" | "character";
  currency: "CNY";
  unitPrice: string;
  unitsPerPrice: number;
  sourceUrl: string;
  retrievedAt: string;
}

export interface SpeechCostSnapshot {
  usageUnits: number;
  estimatedCost: string;
  pricing: SpeechPriceSnapshot;
}

export interface SpeechRoundObservation {
  sampleId: string;
  provider: string;
  sttModel: string;
  ttsModel: string;
  networkProfile: string;
  uploadMode: UploadMode;
  providerEvidence: "real_provider";
  networkEvidence: "local_baseline" | "client_simulation";
  status: "succeeded" | "failed";
  transcript?: string;
  characterErrorRate?: number;
  sttCompletedMs?: number;
  ttsFirstAudioMs?: number;
  ttsCompletedMs?: number;
  totalRoundMs?: number;
  sttAudioSeconds?: number;
  ttsCharacters?: number;
  sttCost?: SpeechCostSnapshot;
  ttsCost?: SpeechCostSnapshot;
  failureCode?: string;
  failureMessage?: string;
}

export interface BenchmarkMetricSummary {
  count: number;
  succeeded: number;
  failed: number;
  p50Ms: number | null;
  p95Ms: number | null;
  meanCharacterErrorRate: number | null;
}

export interface SpeechBenchmarkReport {
  schemaVersion: 1;
  generatedAt: string;
  fixtureManifestHash: string;
  providerEvidence: "none" | "partial" | "complete";
  observations: SpeechRoundObservation[];
  summary: BenchmarkMetricSummary;
  limitations: string[];
}
