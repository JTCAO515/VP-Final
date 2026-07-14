import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";

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

  it("runs second-pass completion through the app router", async () => {
    const tripService = createVersionedInMemoryTripService();
    await tripService.create(
      {
        id: "trip-shell",
        title: "Shell",
        destinationCountry: "CN",
        days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", title: "Arrival", blocks: [] }],
      },
      identity,
      "ai_copilot",
    );
    const caller = appRouter.createCaller({ tripService, identity });

    await expect(
      caller.copilot.completeTrip({ tripId: "trip-shell", expectedVersion: 1 }),
    ).resolves.toMatchObject({
      status: "completed",
      completedDays: 1,
      totalDays: 1,
    });
  });
});
