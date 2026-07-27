import {
  createInMemoryAgentTraceService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createInMemoryTelemetryRateLimiter,
  createInMemoryTelemetryService,
  createVersionedInMemoryTripService,
  type TelemetryService,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestWebServerServices } from "../_server";
import { POST } from "./route";

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret-at-least-local-only";
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  delete process.env.VISEPANDA_ANON_SESSION_SECRET;
  delete process.env.VERCEL;
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

  it("returns a visible 429 before storage when the trusted identity or network window is exhausted", async () => {
    const telemetryService = createInMemoryTelemetryService();
    const rateLimitLog = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    inject(telemetryService, {
      identityMinuteLimit: 1,
      identityHourLimit: 2,
      ipMinuteLimit: 1,
      ipHourLimit: 2,
    });
    process.env.VERCEL = "1";

    expect(
      (
        await POST(
          postRequest(
            { action: "guide_viewed", entity_type: "guide" },
            { trustedIp: "203.0.113.8" },
          ),
        )
      ).status,
    ).toBe(202);

    const blocked = await POST(
      postRequest(
        { action: "guide_viewed", entity_type: "guide" },
        { trustedIp: "203.0.113.8", spoofedIp: "198.51.100.77" },
      ),
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
    await expect(blocked.json()).resolves.toEqual({
      ok: false,
      code: "TELEMETRY_RATE_LIMITED",
      error: "Too many telemetry events were sent recently. Try again in 60 seconds.",
      retryAfterSeconds: 60,
    });
    await expect(telemetryService.list()).resolves.toHaveLength(1);
    expect(rateLimitLog).toHaveBeenCalledWith("telemetry_rate_limited", { rejectionCount: 1 });
    expect(JSON.stringify(rateLimitLog.mock.calls)).not.toContain("203.0.113.8");
    expect(JSON.stringify(rateLimitLog.mock.calls)).not.toContain("198.51.100.77");
  });

  it("fails closed when deployed telemetry cannot establish a trusted address or limiter", async () => {
    const telemetryService = createInMemoryTelemetryService();
    inject(telemetryService);
    process.env.VERCEL = "1";

    const response = await POST(postRequest({ action: "guide_viewed", entity_type: "guide" }));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "TELEMETRY_RATE_LIMIT_UNAVAILABLE",
      error: "Telemetry protection is temporarily unavailable. Try again later.",
    });
    await expect(telemetryService.list()).resolves.toHaveLength(0);
  });
});

function inject(
  telemetryService: TelemetryService,
  limit?: Parameters<typeof createInMemoryTelemetryRateLimiter>[0],
) {
  setTestWebServerServices({
    humanTaskService: createInMemoryHumanTaskService(),
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    telemetryService,
    telemetryRateLimiter: createInMemoryTelemetryRateLimiter(limit),
    tripService: createVersionedInMemoryTripService(),
  });
}

function postRequest(
  body: unknown,
  { trustedIp, spoofedIp }: { trustedIp?: string; spoofedIp?: string } = {},
) {
  return new Request("https://example.test/api/telemetry", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(trustedIp ? { "x-vercel-forwarded-for": trustedIp } : {}),
      ...(spoofedIp ? { "x-forwarded-for": spoofedIp } : {}),
    },
    body: JSON.stringify(body),
  });
}
