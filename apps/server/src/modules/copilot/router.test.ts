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
});
