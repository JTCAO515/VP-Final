import {
  createInMemoryAgentTraceService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  type HumanTaskService,
} from "@visepanda/app-server";
import { createClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { setTestWebServerServices } from "../../_server";
import { POST } from "./route";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

const userId = "00000000-0000-4000-8000-000000000703";
const accessToken = "a".repeat(20);
const getUser = vi.fn();

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.SUPABASE_URL = "https://supabase.example.test";
  process.env.SUPABASE_ANON_KEY = "test-anon-key";
  getUser.mockResolvedValue({
    data: { user: { id: userId, email: "traveler@example.com" } },
    error: null,
  });
  vi.mocked(createClient).mockReturnValue({ auth: { getUser } } as never);
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  setTestWebServerServices(null);
  vi.clearAllMocks();
});

describe("POST /api/mobile/human-help", () => {
  it("derives an authenticated task owner from the bearer token and returns no private request content", async () => {
    const service = createInMemoryHumanTaskService();
    inject(service);

    const response = await POST(postRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      task: { id: expect.any(String), status: "requested", created_at: expect.any(String) },
    });
    const [task] = await service.listForOwner({ kind: "authenticated", userId });
    expect(task).toMatchObject({ contact: "traveler@example.com" });
    expect(JSON.stringify(task)).not.toContain(accessToken);
  });

  it("does not accept an absent bearer token or create a task", async () => {
    const service = createInMemoryHumanTaskService();
    inject(service);

    const response = await POST(postRequest(undefined, false));

    expect(response.status).toBe(401);
    await expect(service.listForOps()).resolves.toEqual([]);
    expect(getUser).not.toHaveBeenCalled();
  });
});

function inject(humanTaskService: HumanTaskService) {
  setTestWebServerServices({
    humanTaskService,
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    tripService: createVersionedInMemoryTripService(),
  });
}

function postRequest(body = validRequest(), withAuthorization = true) {
  return new Request("https://example.test/api/mobile/human-help", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(withAuthorization ? { authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function validRequest() {
  return {
    city: "Shanghai",
    kind: "transport_help",
    description: "Please help me confirm where to meet my driver in Shanghai.",
    contact: "traveler@example.com",
    idempotency_key: "00000000-0000-4000-8000-000000000703",
  };
}
