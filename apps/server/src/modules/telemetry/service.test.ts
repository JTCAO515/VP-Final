import { describe, expect, it } from "vitest";
import { createInMemoryTelemetryService } from "./service.js";

describe("createInMemoryTelemetryService", () => {
  it("stores tracked events", async () => {
    const service = createInMemoryTelemetryService();

    const event = await service.track({
      anon_id: "anon-1",
      surface: "web",
      action: "anonymous_seen",
      entity_type: "session",
    });

    expect(event.id).toBeTruthy();
    await expect(service.list()).resolves.toHaveLength(1);
  });

  it("sends PostHog capture when configured", async () => {
    const calls: unknown[] = [];
    const service = createInMemoryTelemetryService({
      posthog: { apiKey: "ph-test", host: "https://posthog.example" },
      fetchFn: async (...args) => {
        calls.push(args);
        return new Response("{}");
      },
    });

    await service.track({
      anon_id: "anon-1",
      surface: "web",
      action: "outbound_click",
      entity_type: "partner",
      partner: "tripcom",
    });

    expect(JSON.stringify(calls[0])).toContain("ph-test");
    expect(JSON.stringify(calls[0])).toContain("outbound_click");
  });
});
