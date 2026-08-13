import {
  createInMemoryAgentTraceService,
  createInMemoryAnonymousTurnCounter,
  createInMemoryAuthenticatedCopilotRateLimiter,
  createInMemoryCopilotIpRateLimiter,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  TripVersionConflictError,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const authenticatedUser = vi.hoisted(() => ({
  current: null as { id: string; email?: string } | null,
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: authenticatedUser.current } }),
    },
  }),
}));

import { createAnonymousSessionValue } from "../../../lib/requestIdentity";
import { setTestWebServerServices } from "../_server";
import { POST } from "./route";

const originalEnvironment = {
  runtimeMode: process.env.VISEPANDA_RUNTIME_MODE,
  anonSecret: process.env.VISEPANDA_ANON_SESSION_SECRET,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  vercel: process.env.VERCEL,
  maxInputCodeUnits: process.env.VISEPANDA_COPILOT_MAX_INPUT_CODE_UNITS,
};

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  process.env.VERCEL = "1";
  authenticatedUser.current = null;
});

afterEach(() => {
  vi.restoreAllMocks();
  setTestWebServerServices(null);
  restoreEnv("VISEPANDA_RUNTIME_MODE", originalEnvironment.runtimeMode);
  restoreEnv("VISEPANDA_ANON_SESSION_SECRET", originalEnvironment.anonSecret);
  restoreEnv("SUPABASE_URL", originalEnvironment.supabaseUrl);
  restoreEnv("SUPABASE_ANON_KEY", originalEnvironment.supabaseAnonKey);
  restoreEnv("VERCEL", originalEnvironment.vercel);
  restoreEnv("VISEPANDA_COPILOT_MAX_INPUT_CODE_UNITS", originalEnvironment.maxInputCodeUnits);
  authenticatedUser.current = null;
});

describe("POST /api/copilot anonymous turn wall", () => {
  it("rejects an oversized message before request protection or model composition", async () => {
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
      copilotIpRateLimiter: {
        async check() {
          throw new Error("the IP limiter must not run for oversized input");
        },
      },
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    const response = await POST(request("a".repeat(8_001)));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "COPILOT_INPUT_TOO_LARGE",
      error:
        "Copilot messages must be 8000 characters or fewer. Shorten your message and try again.",
      maxInputCodeUnits: 8_000,
    });
  });

  it("uses the stricter deployment input ceiling at the public boundary", async () => {
    process.env.VISEPANDA_COPILOT_MAX_INPUT_CODE_UNITS = "4";
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
      copilotIpRateLimiter: {
        async check() {
          throw new Error("the IP limiter must not run for oversized input");
        },
      },
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    const response = await POST(request("hello"));

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "COPILOT_INPUT_TOO_LARGE",
      maxInputCodeUnits: 4,
    });
  });

  it("enforces the separate authenticated identity window without counting an anonymous turn", async () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-anon-key";
    authenticatedUser.current = {
      id: "11111111-1111-4111-8111-111111111111",
      email: "traveler@example.test",
    };
    setTestWebServerServices({
      authenticatedCopilotRateLimiter: createInMemoryAuthenticatedCopilotRateLimiter({
        minuteLimit: 1,
        hourLimit: 2,
      }),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    expect((await POST(request("First authenticated request"))).status).toBe(200);
    const blocked = await POST(request("Second authenticated request"));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
    await expect(blocked.json()).resolves.toEqual({
      ok: false,
      code: "COPILOT_AUTHENTICATED_RATE_LIMITED",
      error: "Your Copilot account has sent too many requests. Try again in 60 seconds.",
      retryAfterSeconds: 60,
    });
  });

  it("fails closed for an authenticated request when its identity limiter is unavailable", async () => {
    process.env.SUPABASE_URL = "https://project.supabase.co";
    process.env.SUPABASE_ANON_KEY = "public-anon-key";
    authenticatedUser.current = { id: "11111111-1111-4111-8111-111111111111" };
    setTestWebServerServices({
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    const response = await POST(request("Authenticated request"));

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "COPILOT_AUTHENTICATED_RATE_LIMIT_UNAVAILABLE",
      error: "Copilot account request protection is temporarily unavailable. Try again later.",
    });
  });

  it("returns usage after three successful turns and blocks the fourth", async () => {
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    for (let turn = 1; turn <= 3; turn += 1) {
      const response = await POST(request(`Question ${turn}`));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({
        ok: true,
        anonymousUsage: { completedTurns: turn, limit: 3, remaining: 3 - turn },
      });
    }

    const blocked = await POST(request("Question 4"));
    expect(blocked.status).toBe(403);
    await expect(blocked.json()).resolves.toEqual({
      ok: false,
      code: "ANONYMOUS_TURN_LIMIT_REACHED",
      error: "Sign in to continue using the Copilot.",
      anonymousUsage: { completedTurns: 3, limit: 3, remaining: 0 },
    });
  });

  it("fails honestly when the deployed counter is unavailable", async () => {
    setTestWebServerServices({
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    const response = await POST(request("Hello"));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "ANONYMOUS_TURN_CONTROL_UNAVAILABLE",
      error: "Anonymous Copilot access is temporarily unavailable. Sign in or try again later.",
    });
  });

  it("does not wait for observability persistence before returning a valid answer", async () => {
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: {
        recordRun() {
          return new Promise<void>(() => undefined);
        },
      },
      tripService: createVersionedInMemoryTripService(),
    });

    const response = await Promise.race([
      POST(request("Hello")),
      new Promise<"timed-out">((resolve) => setTimeout(() => resolve("timed-out"), 1_000)),
    ]);

    expect(response).not.toBe("timed-out");
    expect(response).toBeInstanceOf(Response);
    expect((response as Response).status).toBe(200);
  });

  it("reports an in-flight capacity reservation without claiming the preview is complete", async () => {
    setTestWebServerServices({
      anonymousTurnCounter: {
        async reserve() {
          return {
            allowed: false,
            reason: "capacity_reserved",
            usage: { completedTurns: 1, limit: 3, remaining: 2 },
          };
        },
      },
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    const response = await POST(request("Concurrent question"));
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "ANONYMOUS_TURN_IN_PROGRESS",
      error: "Another anonymous Copilot question is still finishing. Try again shortly.",
      anonymousUsage: { completedTurns: 1, limit: 3, remaining: 2 },
    });
  });

  it("cannot be bypassed by changing spoofable x-forwarded-for", async () => {
    const observability = createInMemoryAgentTraceService();
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter({
        minuteLimit: 1,
        hourLimit: 2,
      }),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: observability,
      productEventService: observability,
      tripService: createVersionedInMemoryTripService(),
    });

    expect((await POST(request("Allowed", "192.0.2.1"))).status).toBe(200);
    const blocked = await POST(request("Blocked", "198.51.100.99"));

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
    await expect(blocked.json()).resolves.toEqual({
      ok: false,
      code: "COPILOT_IP_RATE_LIMITED",
      error: "This network has sent too many Copilot requests. Try again in 60 seconds.",
      retryAfterSeconds: 60,
    });

    const differentTrustedNetwork = await POST(
      request("Allowed elsewhere", undefined, true, "198.51.100.7"),
    );
    expect(differentTrustedNetwork.status).toBe(200);
    await expect(differentTrustedNetwork.json()).resolves.toMatchObject({
      anonymousUsage: { completedTurns: 2, limit: 3, remaining: 1 },
    });
    expect(observability.listProductEvents()).toMatchObject([
      {
        action: "rate_limited",
        entityType: "copilot_session",
        props: { retryAfterSeconds: 60 },
      },
    ]);
    const persistedEvent = JSON.stringify(observability.listProductEvents());
    expect(persistedEvent).not.toContain("192.0.2.1");
    expect(persistedEvent).not.toContain("198.51.100.99");
    expect(persistedEvent).not.toContain("203.0.113.42");
  });

  it("fails closed when Vercel does not supply a trusted client address", async () => {
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    const response = await POST(request("No trusted address", undefined, false));
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "COPILOT_IP_RATE_LIMIT_UNAVAILABLE",
      error: "Copilot request protection is temporarily unavailable. Try again later.",
    });
  });

  it("does not expose unexpected database or driver details", async () => {
    const knowledgeService = createInMemoryKnowledgeService();
    const internalFailure =
      "Failed query: select * from poi_facts; cookie=private; signature=private";
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: {
        ...knowledgeService,
        async listPois() {
          throw new Error(internalFailure);
        },
      },
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    const response = await POST(request("Shanghai metro advice"));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body).toEqual({
      ok: false,
      code: "COPILOT_REQUEST_FAILED",
      error: "Copilot is temporarily unavailable. Try again later.",
    });
    expect(JSON.stringify(body)).not.toContain("poi_facts");
    expect(JSON.stringify(body)).not.toContain("cookie");
    expect(JSON.stringify(body)).not.toContain("signature");
    expect(errorLog).toHaveBeenCalledWith("copilot_unexpected_failure", {
      failureClass: "unexpected_error",
    });
    expect(JSON.stringify(errorLog.mock.calls)).not.toContain(internalFailure);
  });

  it("preserves the typed Trip conflict response", async () => {
    const tripService = createVersionedInMemoryTripService();
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: {
        ...tripService,
        async get() {
          throw new TripVersionConflictError(7);
        },
      },
    });

    const response = await POST(
      request(
        "Update this Trip",
        undefined,
        true,
        "203.0.113.42",
        "11111111-1111-4111-8111-111111111111",
      ),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      code: "TRIP_VERSION_CONFLICT",
      currentVersion: 7,
      error: "This trip changed in another session. Reload it before trying again.",
    });
  });
});

function request(
  message: string,
  spoofedAddress?: string,
  includeTrustedAddress = true,
  trustedAddress = "203.0.113.42",
  tripId?: string,
): Request {
  const anonId = "a".repeat(43);
  const cookie = createAnonymousSessionValue("test-secret", anonId);
  return new Request("https://example.test/api/copilot", {
    method: "POST",
    headers: {
      cookie: `vp_anon_session=${cookie}`,
      "content-type": "application/json",
      ...(includeTrustedAddress ? { "x-vercel-forwarded-for": trustedAddress } : {}),
      ...(spoofedAddress ? { "x-forwarded-for": spoofedAddress } : {}),
    },
    body: JSON.stringify({ message, ...(tripId ? { tripId } : {}) }),
  });
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
