import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createInMemoryTripService } from "../trip/service.js";

describe("copilotRouter", () => {
  it("runs the copilot pipeline through the app router", async () => {
    const caller = appRouter.createCaller({
      tripService: createInMemoryTripService(),
    });

    const result = await caller.copilot.run({
      message: "Plan a Beijing trip",
      tripId: "trip-beijing",
    });

    expect(result.trip?.title).toBe("China trip draft");
    expect(result.trace.retrievedFactIds).toEqual(["stub:china-execution-basics"]);
  });

  it("runs second-pass completion through the app router", async () => {
    const caller = appRouter.createCaller({
      tripService: createInMemoryTripService([
        {
          id: "trip-shell",
          title: "Shell",
          destinationCountry: "CN",
          days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", title: "Arrival", blocks: [] }],
        },
      ]),
    });

    await expect(caller.copilot.completeTrip({ tripId: "trip-shell" })).resolves.toMatchObject({
      status: "completed",
      completedDays: 1,
      totalDays: 1,
    });
  });
});
