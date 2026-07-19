import {
  createInMemoryAgentTraceService,
  createInMemoryAnonymousTurnCounter,
  createInMemoryCopilotIpRateLimiter,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createAnonymousSessionValue } from "../../../lib/requestIdentity";
import { setTestWebServerServices } from "../_server";
import { POST } from "./route";

const originalEnvironment = {
  runtimeMode: process.env.VISEPANDA_RUNTIME_MODE,
  anonSecret: process.env.VISEPANDA_ANON_SESSION_SECRET,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  vercel: process.env.VERCEL,
};

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  process.env.VERCEL = "1";
});

afterEach(() => {
  setTestWebServerServices(null);
  restoreEnv("VISEPANDA_RUNTIME_MODE", originalEnvironment.runtimeMode);
  restoreEnv("VISEPANDA_ANON_SESSION_SECRET", originalEnvironment.anonSecret);
  restoreEnv("SUPABASE_URL", originalEnvironment.supabaseUrl);
  restoreEnv("SUPABASE_ANON_KEY", originalEnvironment.supabaseAnonKey);
  restoreEnv("VERCEL", originalEnvironment.vercel);
});

describe("POST /api/copilot anonymous turn wall", () => {
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
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
      copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter({
        minuteLimit: 1,
        hourLimit: 2,
      }),
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
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
});

function request(
  message: string,
  spoofedAddress?: string,
  includeTrustedAddress = true,
  trustedAddress = "203.0.113.42",
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
    body: JSON.stringify({ message }),
  });
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
