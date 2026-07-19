import {
  createInMemoryAgentTraceService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  type HumanTaskService,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestWebServerServices } from "../_server";
import { POST } from "./route";

const requestBody = {
  city: "Shanghai",
  kind: "call_restaurant",
  description: "Please call the restaurant to confirm a table for two this evening.",
  contact: "traveler@example.com",
  idempotency_key: "00000000-0000-4000-8000-000000000001",
};

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret-at-least-local-only";
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  delete process.env.VISEPANDA_ANON_SESSION_SECRET;
  setTestWebServerServices(null);
});

describe("POST /api/human-help", () => {
  it("persists through the service and returns only a minimal receipt", async () => {
    const humanTaskService = createInMemoryHumanTaskService();
    inject(humanTaskService);

    const first = await POST(postRequest(requestBody));
    const firstBody = await first.json();
    const cookie = first.headers.get("set-cookie")?.split(";", 1)[0];
    const second = await POST(postRequest(requestBody, cookie));
    const conflicting = await POST(
      postRequest({ ...requestBody, contact: "different@example.com" }, cookie),
    );

    expect(first.status).toBe(200);
    expect(firstBody).toMatchObject({
      ok: true,
      task: { status: "requested", id: expect.any(String), created_at: expect.any(String) },
    });
    expect(firstBody.task).not.toHaveProperty("contact");
    expect(firstBody.task).not.toHaveProperty("description");
    expect(firstBody).not.toHaveProperty("payment");
    expect((await second.json()).task.id).toBe(firstBody.task.id);
    expect(conflicting.status).toBe(409);
    await expect(humanTaskService.listForOps()).resolves.toHaveLength(1);
  });

  it("reports persistence failure without fabricated success", async () => {
    inject({
      create: async () => {
        throw new Error("database offline");
      },
      listForOwner: async () => [],
      listForOps: async () => [],
      getForOps: async () => {
        throw new Error("database offline");
      },
      updateOperatorNote: async () => {
        throw new Error("database offline");
      },
      transition: async () => {
        throw new Error("database offline");
      },
      listTransitions: async () => [],
    });

    const response = await POST(postRequest(requestBody));
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      ok: false,
      error: "Human Help is temporarily unavailable. Your request was not submitted.",
    });
  });

  it("rejects cities outside the controlled preview", async () => {
    inject(createInMemoryHumanTaskService());
    const response = await POST(postRequest({ ...requestBody, city: "Beijing" }));
    expect(response.status).toBe(400);
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

function postRequest(body: unknown, cookie?: string) {
  return new Request("https://example.test/api/human-help", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}
