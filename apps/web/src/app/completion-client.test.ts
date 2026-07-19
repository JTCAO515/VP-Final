import { CompletionJobSchema } from "@visepanda/domain";
import { describe, expect, it } from "vitest";
import {
  COMPLETION_REFERENCE_KEY,
  canRetryCompletion,
  clearCompletionReference,
  completionProgress,
  completionReference,
  completionStateCopy,
  readCompletionReference,
  writeCompletionReference,
} from "./completion-client";

const baseJob = CompletionJobSchema.parse({
  id: "20000000-0000-4000-8000-000000000001",
  tripId: "20000000-0000-4000-8000-000000000002",
  baseVersion: 1,
  idempotencyKey: "20000000-0000-4000-8000-000000000003",
  state: "queued",
  attempt: 0,
  maxAttempts: 2,
  errorCode: null,
  createdAt: "2026-07-19T00:00:00.000Z",
  updatedAt: "2026-07-19T00:00:00.000Z",
  startedAt: null,
  completedAt: null,
});

describe("completion browser state", () => {
  it("persists only the owner-scoped completion reference and rejects malformed storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    };

    const reference = completionReference(baseJob);
    writeCompletionReference(storage, reference);

    expect(readCompletionReference(storage)).toEqual(reference);
    expect(JSON.parse(values.get(COMPLETION_REFERENCE_KEY)!)).toEqual(reference);
    values.set(COMPLETION_REFERENCE_KEY, JSON.stringify({ ...reference, ownerId: "forged" }));
    expect(readCompletionReference(storage)).toBeNull();
    clearCompletionReference(storage);
    expect(values.has(COMPLETION_REFERENCE_KEY)).toBe(false);
  });

  it("maps durable states to truthful progress and bounds retries", () => {
    const trip = {
      id: baseJob.tripId,
      title: "Shanghai shell",
      destinationCountry: "CN" as const,
      days: [
        {
          id: "day-1",
          dayNumber: 1,
          blocks: [{ id: "block-1", type: "transport" as const, title: "Arrival" }],
        },
        { id: "day-2", dayNumber: 2, blocks: [] },
      ],
    };

    expect(completionProgress(baseJob, trip)).toMatchObject({
      status: "completing",
      completedDays: 1,
      totalDays: 2,
      attempts: 0,
    });
    expect(canRetryCompletion({ ...baseJob, state: "partial", attempt: 1 })).toBe(true);
    expect(canRetryCompletion({ ...baseJob, state: "failed", attempt: 2 })).toBe(false);
    expect(canRetryCompletion({ ...baseJob, state: "conflicted", attempt: 1 })).toBe(false);
    expect(completionProgress({ ...baseJob, state: "partial", attempt: 1 }, trip)).toMatchObject({
      status: "failed",
      error: "Some trip details could not be completed.",
    });
    expect(completionStateCopy({ ...baseJob, state: "conflicted" })).toMatchObject({
      title: "Trip changed before completion",
    });
  });
});
