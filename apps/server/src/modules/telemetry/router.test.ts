import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryTelemetryService } from "./service.js";

describe("telemetryRouter", () => {
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
