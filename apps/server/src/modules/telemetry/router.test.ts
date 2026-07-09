import { describe, expect, it } from "vitest";
import { appRouter } from "../../router.js";
import { createInMemoryTelemetryService } from "./service.js";

describe("telemetryRouter", () => {
  it("tracks events through the app router", async () => {
    const telemetryService = createInMemoryTelemetryService();
    const caller = appRouter.createCaller({
      tripService: {
        create: async (trip) => trip,
        save: async (trip) => trip,
        get: async () => null,
      },
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
