import { describe, expect, it, vi } from "vitest";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryCompletionJobService } from "./completionJobService.js";
import { createCompletionProcessor } from "./completionProcessor.js";
import type { CompletionQueue } from "./completionQueue.js";

const tripId = "20000000-0000-0000-0000-000000000001";
const idempotencyKey = "20000000-0000-0000-0000-000000000002";
const identity = { kind: "anonymous" as const, anonId: "processor-owner" };

async function setup(completeDay: Parameters<typeof createCompletionProcessor>[0]["completeDay"]) {
  const tripService = createVersionedInMemoryTripService();
  await tripService.create(
    {
      id: tripId,
      title: "Shanghai shell",
      destinationCountry: "CN",
      days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", blocks: [] }],
    },
    identity,
    "ai_copilot",
  );
  const jobService = createInMemoryCompletionJobService(tripService);
  const job = await jobService.create(
    { tripId, baseVersion: 1, idempotencyKey, maxAttempts: 2 },
    identity,
  );
  const publish = vi.fn(async () => undefined);
  const queue = { publish, verify: vi.fn(async () => true) } satisfies CompletionQueue;
  return {
    job,
    jobService,
    tripService,
    publish,
    processor: createCompletionProcessor({ completeDay, jobService, queue, tripService }),
  };
}

describe("completion processor", () => {
  it("suppresses duplicate delivery and appends one linked Trip event", async () => {
    const setupResult = await setup(async (day) => ({
      id: `completed-${day.id}`,
      type: "attraction",
      title: "Yu Garden",
    }));
    const payload = { jobId: setupResult.job.id, idempotencyKey };

    await expect(setupResult.processor.process(payload)).resolves.toEqual({
      accepted: true,
      state: "completed",
    });
    await expect(setupResult.processor.process(payload)).resolves.toEqual({
      accepted: false,
      state: "duplicate",
    });
    const events = await setupResult.tripService.getEvents(tripId, identity);
    expect(events).toHaveLength(2);
    expect(events?.[1]?.completion).toEqual({ jobId: setupResult.job.id, attempt: 1 });
  });

  it("marks stale Trip state conflicted without overwrite", async () => {
    const setupResult = await setup(async () => ({
      id: "never-applied",
      type: "attraction",
      title: "Never applied",
    }));
    await setupResult.tripService.apply({
      id: tripId,
      identity,
      expectedVersion: 1,
      patch: { operations: [{ op: "update_trip", fields: { title: "Traveler edit" } }] },
      source: "user_manual",
    });

    await expect(
      setupResult.processor.process({ jobId: setupResult.job.id, idempotencyKey }),
    ).resolves.toEqual({ accepted: true, state: "conflicted" });
    await expect(setupResult.tripService.get(tripId, identity)).resolves.toMatchObject({
      trip: { title: "Traveler edit", days: [{ blocks: [] }] },
      version: 2,
    });
  });

  it("requeues transient failure only below max attempts", async () => {
    const setupResult = await setup(async () => {
      throw new Error("provider unavailable");
    });
    const payload = { jobId: setupResult.job.id, idempotencyKey };

    await expect(setupResult.processor.process(payload)).resolves.toEqual({
      accepted: true,
      state: "queued",
    });
    expect(setupResult.publish).toHaveBeenCalledWith(payload, 2);
    await expect(setupResult.processor.process(payload)).resolves.toEqual({
      accepted: true,
      state: "failed",
    });
    await expect(setupResult.jobService.get(setupResult.job.id, identity)).resolves.toMatchObject({
      state: "failed",
      attempt: 2,
    });
  });
});
