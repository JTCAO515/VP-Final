import { describe, expect, it } from "vitest";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createTwoPassWorker } from "./twoPassWorker.js";

const skeletonTrip = {
  id: "trip-two-pass",
  title: "Two pass",
  destinationCountry: "CN" as const,
  days: [
    { id: "day-1", dayNumber: 1, city: "Shanghai", title: "Arrival", blocks: [] },
    { id: "day-2", dayNumber: 2, city: "Shanghai", title: "Old town", blocks: [] },
  ],
};
const identity = { kind: "anonymous" as const, anonId: "anon-two-pass" };

async function seededTripService() {
  const tripService = createVersionedInMemoryTripService();
  await tripService.create(skeletonTrip, identity, "ai_copilot");
  return tripService;
}

describe("createTwoPassWorker", () => {
  it("fills empty skeleton days and reports progress", async () => {
    const tripService = await seededTripService();
    const worker = createTwoPassWorker({ tripService });

    const progress = await worker.completeTrip(
      { tripId: skeletonTrip.id, expectedVersion: 1 },
      identity,
    );
    const completedTrip = await tripService.get(skeletonTrip.id, identity);
    const events = await tripService.getEvents(skeletonTrip.id, identity);

    expect(progress).toEqual({
      status: "completed",
      completedDays: 2,
      totalDays: 2,
      attempts: 2,
      error: null,
    });
    expect(completedTrip?.trip.days.map((day) => day.blocks[0]?.title)).toEqual([
      "Arrival details",
      "Old town details",
    ]);
    expect(events?.map((event) => event.version)).toEqual([1, 2]);
  });

  it("retries a failed day before succeeding", async () => {
    let calls = 0;
    const tripService = await seededTripService();
    const worker = createTwoPassWorker({
      tripService,
      completeDay: async (day) => {
        calls += 1;
        if (calls === 1) throw new Error("temporary failure");

        return {
          id: `retry-${day.id}`,
          type: "free_time",
          title: `${day.title} retry`,
        };
      },
    });

    const progress = await worker.completeTrip(
      { tripId: skeletonTrip.id, expectedVersion: 1 },
      identity,
    );

    expect(progress.status).toBe("completed");
    expect(progress.attempts).toBe(3);
  });

  it("returns failed progress when retries are exhausted", async () => {
    const tripService = await seededTripService();
    const worker = createTwoPassWorker({
      tripService,
      completeDay: async () => {
        throw new Error("upstream unavailable");
      },
    });

    await expect(
      worker.completeTrip(
        { tripId: skeletonTrip.id, expectedVersion: 1, maxAttemptsPerDay: 1 },
        identity,
      ),
    ).resolves.toMatchObject({
      status: "failed",
      completedDays: 0,
      attempts: 1,
      error: "upstream unavailable",
    });
  });
});
