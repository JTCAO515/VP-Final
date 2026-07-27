import { describe, expect, it, vi } from "vitest";
import { createInMemoryTelemetryService } from "./service.js";

describe("createInMemoryTelemetryService", () => {
  it("stores validated events with an explicit retention deadline", async () => {
    const service = createInMemoryTelemetryService({
      now: () => new Date("2026-07-27T12:00:00.000Z"),
      randomId: () => "00000000-0000-4000-8000-000000000201",
    });

    const event = await service.track({
      anon_id: "a".repeat(43),
      surface: "web",
      action: "guide_viewed",
      entity_type: "guide",
      entity_id: "payment-guide",
      props_jsonb: { city: "Shanghai" },
    });

    expect(event).toMatchObject({
      id: "00000000-0000-4000-8000-000000000201",
      retention_expires_at: "2027-01-23T12:00:00.000Z",
    });
    await expect(service.list()).resolves.toHaveLength(1);
  });

  it("sends only validated event data to PostHog when configured", async () => {
    const calls: unknown[] = [];
    const service = createInMemoryTelemetryService({
      posthog: { apiKey: "ph-test", host: "https://posthog.example" },
      fetchFn: async (...args) => {
        calls.push(args);
        return new Response("{}");
      },
    });

    await service.track({
      anon_id: "a".repeat(43),
      surface: "web",
      action: "poi_viewed",
      entity_type: "poi",
      entity_id: "shanghai.yu-garden",
      props_jsonb: { city: "Shanghai", category: "Attraction" },
    });

    expect(JSON.stringify(calls[0])).toContain("ph-test");
    expect(JSON.stringify(calls[0])).toContain("poi_viewed");
  });

  it("keeps the durable event when optional delivery fails", async () => {
    const onDeliveryError = vi.fn();
    const service = createInMemoryTelemetryService({
      posthog: { apiKey: "ph-test" },
      fetchFn: async () => {
        throw new Error("delivery offline");
      },
      onDeliveryError,
    });

    await expect(
      service.track({
        anon_id: "a".repeat(43),
        surface: "web",
        action: "human_help_viewed",
        entity_type: "human_help",
        props_jsonb: { city: "Shanghai" },
      }),
    ).resolves.toBeDefined();
    await expect(service.list()).resolves.toHaveLength(1);
    expect(onDeliveryError).toHaveBeenCalledOnce();
  });

  it("rejects arbitrary or sensitive properties before storage or delivery", async () => {
    const fetchFn = vi.fn<typeof fetch>();
    const service = createInMemoryTelemetryService({
      posthog: { apiKey: "ph-test" },
      fetchFn,
    });

    await expect(
      service.track({
        anon_id: "a".repeat(43),
        surface: "web",
        action: "task_started",
        entity_type: "human_task",
        props_jsonb: { description: "Call this restaurant" },
      }),
    ).rejects.toThrow();
    await expect(service.list()).resolves.toHaveLength(0);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});
