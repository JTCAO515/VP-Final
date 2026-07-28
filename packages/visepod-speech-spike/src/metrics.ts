import { createHash } from "node:crypto";

import type {
  BenchmarkMetricSummary,
  SpeechBenchmarkSample,
  SpeechRoundObservation,
} from "./types.js";

function normalizeTranscript(value: string): string[] {
  return Array.from(
    value
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .replace(/[\s\p{P}\p{S}]+/gu, ""),
  );
}

function levenshteinDistance(left: readonly string[], right: readonly string[]): number {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = new Array<number>(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      current[j] = Math.min(
        current[j - 1]! + 1,
        previous[j]! + 1,
        previous[j - 1]! + (left[i - 1] === right[j - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length]!;
}

export function characterErrorRate(expected: string, actual: string): number {
  const expectedCharacters = normalizeTranscript(expected);
  const actualCharacters = normalizeTranscript(actual);
  if (expectedCharacters.length === 0) {
    return actualCharacters.length === 0 ? 0 : 1;
  }
  return levenshteinDistance(expectedCharacters, actualCharacters) / expectedCharacters.length;
}

export function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) {
    return null;
  }
  if (percentileValue < 0 || percentileValue > 1) {
    throw new Error("percentile must be between 0 and 1");
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower]!;
  }
  const weight = index - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

export function summarizeObservations(
  observations: readonly SpeechRoundObservation[],
): BenchmarkMetricSummary {
  const succeeded = observations.filter((observation) => observation.status === "succeeded");
  const latencies = succeeded
    .map((observation) => observation.totalRoundMs)
    .filter((value): value is number => value !== undefined);
  const errorRates = succeeded
    .map((observation) => observation.characterErrorRate)
    .filter((value): value is number => value !== undefined);

  return {
    count: observations.length,
    succeeded: succeeded.length,
    failed: observations.length - succeeded.length,
    p50Ms: percentile(latencies, 0.5),
    p95Ms: percentile(latencies, 0.95),
    meanCharacterErrorRate:
      errorRates.length === 0
        ? null
        : errorRates.reduce((total, value) => total + value, 0) / errorRates.length,
  };
}

export function hashFixtureManifest(samples: readonly SpeechBenchmarkSample[]): string {
  return createHash("sha256").update(JSON.stringify(samples)).digest("hex");
}
