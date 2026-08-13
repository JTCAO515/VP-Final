import {
  createInMemoryAgentTraceService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  type HumanTaskService,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestWebServerServices } from "../../_server";
import { GET } from "./route";

const task = {
  id: "00000000-0000-4000-8000-000000000001",
  city: "Shanghai",
  kind: "ticket_help" as const,
  description: "Private traveler description that must not reach this owner projection.",
  contact: "traveler@example.com",
  status: "payment_pending" as const,
  price_usd: 14.99,
  payment_link: "https://checkout.stripe.com/c/pay/cs_test_owner_001",
  operator_note: "Private Ops note",
  retention_expires_at: null,
  created_at: "2026-08-14T00:00:00.000Z",
  updated_at: "2026-08-14T01:00:00.000Z",
};

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret-at-least-local-only";
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  delete process.env.VISEPANDA_ANON_SESSION_SECRET;
  setTestWebServerServices(null);
  vi.restoreAllMocks();
});

describe("GET /api/human-help/tasks", () => {
  it("returns only the signed owner payment-pending projection with private caching disabled", async () => {
    const listForOwner = vi.fn(async () => [task]);
    inject({ listForOwner });

    const response = await GET(new Request("https://example.test/api/human-help/tasks"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(listForOwner).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "anonymous", anonId: expect.any(String) }),
    );
    expect(payload).toEqual({
      ok: true,
      tasks: [
        {
          id: task.id,
          status: "payment_pending",
          created_at: task.created_at,
          updated_at: task.updated_at,
          price_usd: 14.99,
          payment_link: task.payment_link,
        },
      ],
    });
    expect(JSON.stringify(payload)).not.toContain(task.contact);
    expect(JSON.stringify(payload)).not.toContain(task.description);
    expect(JSON.stringify(payload)).not.toContain("Private Ops note");
  });

  it("does not expose a link or amount for any task status other than payment_pending", async () => {
    inject({ listForOwner: async () => [{ ...task, status: "paid" as const }] });

    const response = await GET(new Request("https://example.test/api/human-help/tasks"));

    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      tasks: [{ status: "paid", payment_link: null, price_usd: null }],
    });
  });

  it("reports durable read failure honestly without a stale payment link", async () => {
    inject({
      listForOwner: async () => {
        throw new Error("database offline");
      },
    });

    const response = await GET(new Request("https://example.test/api/human-help/tasks"));
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toEqual({
      ok: false,
      error: "Human Help requests are temporarily unavailable.",
    });
    expect(JSON.stringify(payload)).not.toContain("checkout.stripe.com");
  });
});

function inject(overrides: Pick<HumanTaskService, "listForOwner">) {
  const unavailable = async () => {
    throw new Error("not used");
  };
  setTestWebServerServices({
    humanTaskService: {
      create: unavailable,
      listForOwner: overrides.listForOwner,
      listForOps: async () => [],
      getForOps: unavailable,
      updateOperatorNote: unavailable,
      appendEvidence: unavailable,
      listEvidence: async () => [],
      transition: unavailable,
      listTransitions: async () => [],
    },
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    tripService: createVersionedInMemoryTripService(),
  });
}
