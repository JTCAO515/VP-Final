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
        action: "guide_viewed",
        entity_type: "guide",
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
      identity: { kind: "anonymous", anonId: "a".repeat(43) },
    });

    const event = await caller.telemetry.track({
      action: "guide_viewed",
      entity_type: "guide",
      entity_id: "payment-guide",
      props_jsonb: { city: "Shanghai" },
    });

    expect(event.anon_id).toBe("a".repeat(43));
    expect(event.surface).toBe("web");
    await expect(telemetryService.list()).resolves.toHaveLength(1);
  });

  it("rejects capture when no trusted request identity exists", async () => {
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      telemetryService: createInMemoryTelemetryService(),
    });

    await expect(
      caller.telemetry.track({ action: "guide_viewed", entity_type: "guide" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("accepts an idempotent mobile event only for an authenticated identity", async () => {
    const telemetryService = createInMemoryTelemetryService();
    const caller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      telemetryService,
      identity: { kind: "authenticated", userId: "00000000-0000-4000-8000-000000000101" },
    });
    const input = {
      id: "00000000-0000-4000-8000-000000000102",
      action: "tool_opened" as const,
      entity_type: "tool",
      entity_id: "translation",
      props_jsonb: { tool: "translation" },
    };

    await caller.telemetry.trackMobile(input);
    await caller.telemetry.trackMobile(input);

    await expect(telemetryService.list()).resolves.toHaveLength(1);
    const anonymousCaller = appRouter.createCaller({
      tripService: createVersionedInMemoryTripService(),
      telemetryService,
      identity: { kind: "anonymous", anonId: "a".repeat(43) },
    });
    await expect(anonymousCaller.telemetry.trackMobile(input)).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
