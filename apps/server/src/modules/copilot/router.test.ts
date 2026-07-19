import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryCompletionJobService } from "./completionJobService.js";
import { createInMemoryAnonymousTurnCounter } from "./anonymousTurnCounter.js";
import type { CompletionQueue } from "./completionQueue.js";

const identity = { kind: "anonymous" as const, anonId: "anon-beijing" };

describe("copilotRouter", () => {
  it("runs the copilot pipeline through the app router", async () => {
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      identity,
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter(),
    });

    const result = await caller.copilot.run({
      message: "Plan a Beijing trip",
    });

    expect(result.trip?.title).toBe("Beijing first-timer");
    expect(result.trace.retrievedFactIds).toEqual([]);
    expect(result.anonymousUsage).toEqual({ completedTurns: 1, limit: 3, remaining: 2 });
  });

  it("rejects an anonymous fourth turn before model generation", async () => {
    const anonymousTurnCounter = createInMemoryAnonymousTurnCounter({ limit: 3 });
    let generationCalls = 0;
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      identity,
      anonymousTurnCounter,
      copilotModelDependencies: {
        routeIntent: () => "chat_only",
        generateEnvelope: () => {
          generationCalls += 1;
          return {
            intent: "chat_only",
            message: { headline: "Answer", body: "Useful answer", highlights: [] },
            citations: [],
          };
        },
      },
    });

    await caller.copilot.run({ message: "First" });
    await caller.copilot.run({ message: "Second" });
    const third = await caller.copilot.run({ message: "Third" });
    expect(third.anonymousUsage).toEqual({ completedTurns: 3, limit: 3, remaining: 0 });

    await expect(caller.copilot.run({ message: "Fourth" })).rejects.toMatchObject({
      cause: expect.objectContaining({ code: "ANONYMOUS_TURN_LIMIT_REACHED" }),
    });
    expect(generationCalls).toBe(3);
  });

  it("does not require the anonymous counter for an authenticated traveler", async () => {
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      identity: { kind: "authenticated", userId: crypto.randomUUID() },
    });

    await expect(caller.copilot.run({ message: "Hello" })).resolves.toMatchObject({
      anonymousUsage: null,
    });
  });

  it("releases the anonymous reservation when model generation fails", async () => {
    let attempts = 0;
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      identity,
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 1 }),
      copilotModelDependencies: {
        routeIntent: () => "chat_only",
        generateEnvelope: () => {
          attempts += 1;
          if (attempts === 1) throw new Error("provider unavailable");
          return {
            intent: "chat_only",
            message: { headline: "Recovered", body: "Retry succeeded", highlights: [] },
            citations: [],
          };
        },
      },
    });

    await expect(caller.copilot.run({ message: "First attempt" })).rejects.toThrow(
      "provider unavailable",
    );
    await expect(caller.copilot.run({ message: "Retry" })).resolves.toMatchObject({
      anonymousUsage: { completedTurns: 1, limit: 1, remaining: 0 },
    });
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
