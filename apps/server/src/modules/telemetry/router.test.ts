import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryTelemetryService } from "./service.js";

describe("telemetryRouter", () => {
  it("fails closed when the composition root omits Telemetry", async () => {
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
    });

    await expect(
      caller.telemetry.track({
        anon_id: "anon-1",
        surface: "web",
        action: "registered",
        entity_type: "user",
      }),
    ).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
      message: "Telemetry is unavailable.",
    });
  });

  it("tracks events through the app router", async () => {
    const telemetryService = createInMemoryTelemetryService();
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      telemetryService,
    });

    await caller.telemetry.track({
      anon_id: "anon-1",
      surface: "web",
      action: "registered",
      entity_type: "user",
    });

    await expect(telemetryService.list()).resolves.toHaveLength(1);
  });
});
