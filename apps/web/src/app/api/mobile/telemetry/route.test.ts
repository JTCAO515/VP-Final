import {
  createInMemoryAgentTraceService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createInMemoryTelemetryRateLimiter,
  createInMemoryTelemetryService,
  createVersionedInMemoryTripService,
  type TelemetryService,
} from "@visepanda/app-server";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestWebServerServices } from "../../_server";
import { POST } from "./route";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const userId = "00000000-0000-4000-8000-000000000501";
const accessToken = "a".repeat(20);
const getUser = vi.fn();

beforeEach(() => {
  process.env.VERCEL = "1";
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
  vi.mocked(createClient).mockReturnValue({
    auth: {
      getUser,
    },
  } as never);
});

afterEach(() => {
  delete process.env.VERCEL;
  delete process.env.VISEPANDA_RUNTIME_MODE;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  setTestWebServerServices(null);
  vi.clearAllMocks();
});

describe("POST /api/mobile/telemetry", () => {
  it("derives the verified owner and acknowledges one retry-safe mobile observation", async () => {
    const telemetryService = createInMemoryTelemetryService();
    inject(telemetryService);

    const response = await POST(postRequest(validEvent()));

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ ok: true });
    const [event] = await telemetryService.list();
    expect(event).toMatchObject({
      user_id: userId,
      surface: "mobile",
      action: "tool_opened",
      entity_id: "translation",
    });
    expect(JSON.stringify(event)).not.toContain(accessToken);
  });

  it("rejects raw content before session validation or storage", async () => {
    const telemetryService = createInMemoryTelemetryService();
    inject(telemetryService);

    const response = await POST(
      postRequest({
        ...validEvent(),
        props_jsonb: { tool: "translation", prompt: "private trip" },
      }),
    );

    expect(response.status).toBe(400);
    await expect(telemetryService.list()).resolves.toHaveLength(0);
    expect(getUser).not.toHaveBeenCalled();
  });

  it("returns a visible retry boundary before a second event reaches storage", async () => {
    const telemetryService = createInMemoryTelemetryService();
    inject(telemetryService, {
      identityMinuteLimit: 1,
      identityHourLimit: 2,
      ipMinuteLimit: 2,
      ipHourLimit: 3,
    });

    expect((await POST(postRequest(validEvent()))).status).toBe(202);
    const blocked = await POST(
      postRequest({ ...validEvent(), id: "00000000-0000-4000-8000-000000000502" }),
    );

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get("retry-after")).toBe("60");
    await expect(telemetryService.list()).resolves.toHaveLength(1);
  });
});

function inject(
  telemetryService: TelemetryService,
  limit?: Parameters<typeof createInMemoryTelemetryRateLimiter>[0],
) {
  setTestWebServerServices({
    humanTaskService: createInMemoryHumanTaskService(),
    knowledgeService: createInMemoryKnowledgeService(),
    telemetryRateLimiter: createInMemoryTelemetryRateLimiter(limit),
    telemetryService,
    traceService: createInMemoryAgentTraceService(),
    tripService: createVersionedInMemoryTripService(),
  });
}

function validEvent() {
  return {
    id: "00000000-0000-4000-8000-000000000501",
    action: "tool_opened",
    entity_type: "tool",
    entity_id: "translation",
    props_jsonb: { tool: "translation" },
  };
}

function postRequest(body: unknown) {
  return new Request("https://example.test/api/mobile/telemetry", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "x-vercel-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify(body),
  });
}
