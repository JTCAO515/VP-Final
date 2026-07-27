import {
  createInMemoryAgentTraceService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createInMemoryTelemetryService,
  createVersionedInMemoryTripService,
  type TelemetryService,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestWebServerServices } from "../_server";
import { POST } from "./route";

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret-at-least-local-only";
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  delete process.env.VISEPANDA_ANON_SESSION_SECRET;
  setTestWebServerServices(null);
});

describe("POST /api/telemetry", () => {
  it("derives anonymous identity server-side and does not return event content", async () => {
    const telemetryService = createInMemoryTelemetryService();
    inject(telemetryService);

    const response = await POST(
      postRequest({
        action: "guide_viewed",
        entity_type: "guide",
        entity_id: "payment-guide",
        props_jsonb: { city: "Shanghai" },
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true });
    const [event] = await telemetryService.list();
    expect(event).toMatchObject({
      surface: "web",
      action: "guide_viewed",
      entity_type: "guide",
      anon_id: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/),
    });
    expect(event).not.toHaveProperty("user_message");
  });

  it("rejects forged identity, timestamps, and unrestricted client fields", async () => {
    const telemetryService = createInMemoryTelemetryService();
    inject(telemetryService);

    const response = await POST(
      postRequest({
        action: "guide_viewed",
        entity_type: "guide",
        user_id: "00000000-0000-4000-8000-000000000301",
        created_at: "2020-01-01T00:00:00.000Z",
        props_jsonb: { email: "traveler@example.com" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(telemetryService.list()).resolves.toHaveLength(0);
  });

  it("reports persistence failure without claiming capture succeeded", async () => {
    inject({
      track: async () => {
        throw new Error("database offline");
      },
    });

    const response = await POST(postRequest({ action: "guide_viewed", entity_type: "guide" }));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Telemetry is temporarily unavailable.",
    });
  });
});

function inject(telemetryService: TelemetryService) {
  setTestWebServerServices({
    humanTaskService: createInMemoryHumanTaskService(),
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    telemetryService,
    tripService: createVersionedInMemoryTripService(),
  });
}

function postRequest(body: unknown) {
  return new Request("https://example.test/api/telemetry", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
