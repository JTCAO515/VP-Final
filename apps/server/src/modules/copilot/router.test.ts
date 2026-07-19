import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryCompletionJobService } from "./completionJobService.js";
import type { CompletionQueue } from "./completionQueue.js";

const identity = { kind: "anonymous" as const, anonId: "anon-beijing" };

describe("copilotRouter", () => {
  it("runs the copilot pipeline through the app router", async () => {
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      identity,
    });

    const result = await caller.copilot.run({
      message: "Plan a Beijing trip",
    });

    expect(result.trip?.title).toBe("Beijing first-timer");
    expect(result.trace.retrievedFactIds).toEqual([]);
  });

  it("queues second-pass completion through injected durable services", async () => {
    const tripService = createVersionedInMemoryTripService();
    const tripId = "20000000-0000-0000-0000-000000000001";
    await tripService.create(
      {
        id: tripId,
        title: "Shell",
        destinationCountry: "CN",
        days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", title: "Arrival", blocks: [] }],
      },
      identity,
      "ai_copilot",
    );
    const completionJobService = createInMemoryCompletionJobService(tripService);
    const deliveries: unknown[] = [];
    const completionQueue = {
      async publish(payload: unknown) {
        deliveries.push(payload);
      },
      async verify() {
        return true;
      },
    } satisfies CompletionQueue;
    const caller = appRouter.createCaller({
      tripService,
      identity,
      completionJobService,
      completionQueue,
    });

    const job = await caller.copilot.completeTrip({ tripId, expectedVersion: 1 });
    expect(job).toMatchObject({
      state: "queued",
      tripId,
      baseVersion: 1,
    });
    await expect(caller.copilot.completionStatus({ id: job.id })).resolves.toMatchObject({
      id: job.id,
      state: "queued",
    });
    const otherCaller = appRouter.createCaller({
      tripService,
      identity: { kind: "anonymous", anonId: "other-owner" },
      completionJobService,
      completionQueue,
    });
    await expect(otherCaller.copilot.completionStatus({ id: job.id })).resolves.toBeNull();
    expect(deliveries).toHaveLength(1);
  });

  it("fails honestly when the durable queue is not configured", async () => {
    const tripService = createVersionedInMemoryTripService();
    const tripId = "20000000-0000-0000-0000-000000000010";
    await tripService.create(
      {
        id: tripId,
        title: "Shell",
        destinationCountry: "CN",
        days: [],
      },
      identity,
      "ai_copilot",
    );
    const caller = appRouter.createCaller({
      tripService,
      identity,
      completionJobService: createInMemoryCompletionJobService(tripService),
    });

    await expect(caller.copilot.completeTrip({ tripId, expectedVersion: 1 })).rejects.toMatchObject(
      { code: "SERVICE_UNAVAILABLE" },
    );
  });
});
