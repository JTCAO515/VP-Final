import {
  createInMemoryAgentTraceService,
  createInMemoryAnonymousTurnCounter,
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
};

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret";
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
});

afterEach(() => {
  setTestWebServerServices(null);
  restoreEnv("VISEPANDA_RUNTIME_MODE", originalEnvironment.runtimeMode);
  restoreEnv("VISEPANDA_ANON_SESSION_SECRET", originalEnvironment.anonSecret);
  restoreEnv("SUPABASE_URL", originalEnvironment.supabaseUrl);
  restoreEnv("SUPABASE_ANON_KEY", originalEnvironment.supabaseAnonKey);
});

describe("POST /api/copilot anonymous turn wall", () => {
  it("returns usage after three successful turns and blocks the fourth", async () => {
    setTestWebServerServices({
      anonymousTurnCounter: createInMemoryAnonymousTurnCounter({ limit: 3 }),
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
});

function request(message: string): Request {
  const anonId = "a".repeat(43);
  const cookie = createAnonymousSessionValue("test-secret", anonId);
  return new Request("https://example.test/api/copilot", {
    method: "POST",
    headers: {
      cookie: `vp_anon_session=${cookie}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
