import {
  InvalidOutboundTargetError,
  PartnerUnavailableError,
  createInMemoryAgentTraceService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  type CommerceService,
  type CreateOutboundRedirectCommand,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestWebServerServices } from "../api/_server";
import { GET } from "./route";

const redirectUrl =
  "https://www.trip.com/hotels?locale=en-US&vp_click_id=00000000-0000-4000-8000-000000000201";

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = "test-secret-at-least-local-only";
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  delete process.env.VISEPANDA_ANON_SESSION_SECRET;
  setTestWebServerServices(null);
});

describe("GET /outbound", () => {
  it("uses the signed anonymous identity and returns a recorded redirect", async () => {
    const createOutboundRedirect = vi.fn(async (input: CreateOutboundRedirectCommand) => ({
      click: {
        id: "00000000-0000-4000-8000-000000000201",
        partner: input.partnerKey,
        targetUrl: input.targetUrl,
        userId: null,
        anonId: input.identity.kind === "anonymous" ? input.identity.anonId : null,
        source: input.source,
        intent: input.intent,
        entityId: input.entityId,
        createdAt: "2026-07-26T00:00:00.000Z",
      },
      redirectUrl,
    }));
    inject({ createOutboundRedirect });

    const response = await GET(
      request(
        "partner=tripcom&url=https%3A%2F%2Fwww.trip.com%2Fhotels%3Flocale%3Den-US&source=explore&intent=commerce_intent&entityId=poi-1&userId=forged&anonId=forged",
      ),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(redirectUrl);
    expect(response.headers.get("set-cookie")).toContain("vp_anon_session=");
    expect(createOutboundRedirect).toHaveBeenCalledWith(
      expect.objectContaining({
        identity: { kind: "anonymous", anonId: expect.stringMatching(/^[A-Za-z0-9_-]{43}$/) },
        partnerKey: "tripcom",
        source: "explore",
        intent: "commerce_intent",
        entityId: "poi-1",
      }),
    );
    expect(createOutboundRedirect.mock.calls[0]?.[0]).not.toHaveProperty("userId");
  });

  it.each([
    [new PartnerUnavailableError(), 404, "This partner link is unavailable."],
    [new InvalidOutboundTargetError(), 400, "This partner destination is invalid."],
  ])("does not redirect rejected partner requests", async (error, status, message) => {
    inject({
      createOutboundRedirect: async () => {
        throw error;
      },
    });

    const response = await GET(request("partner=tripcom&url=https%3A%2F%2Fwww.trip.com%2Fhotels"));

    expect(response.status).toBe(status);
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toEqual({ error: message });
  });

  it("fails honestly without redirecting when the authoritative ledger write fails", async () => {
    inject({
      createOutboundRedirect: async () => {
        throw new Error("database offline");
      },
    });

    const response = await GET(request("partner=tripcom&url=https%3A%2F%2Fwww.trip.com%2Fhotels"));

    expect(response.status).toBe(502);
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: "This partner link is temporarily unavailable. No click was recorded.",
    });
  });

  it("rejects missing partner input before calling the ledger", async () => {
    const createOutboundRedirect = vi.fn<CommerceService["createOutboundRedirect"]>();
    inject({ createOutboundRedirect });

    const response = await GET(request("url=https%3A%2F%2Fwww.trip.com%2Fhotels"));

    expect(response.status).toBe(400);
    expect(createOutboundRedirect).not.toHaveBeenCalled();
  });

  it("rejects free-form metadata instead of persisting contact-shaped input", async () => {
    const createOutboundRedirect = vi.fn<CommerceService["createOutboundRedirect"]>();
    inject({ createOutboundRedirect });

    const response = await GET(
      request(
        "partner=tripcom&url=https%3A%2F%2Fwww.trip.com%2Fhotels&source=traveler%40example.com",
      ),
    );

    expect(response.status).toBe(400);
    expect(createOutboundRedirect).not.toHaveBeenCalled();
  });

  it("reports an unavailable Commerce service without pretending to redirect", async () => {
    setTestWebServerServices({
      humanTaskService: createInMemoryHumanTaskService(),
      knowledgeService: createInMemoryKnowledgeService(),
      traceService: createInMemoryAgentTraceService(),
      tripService: createVersionedInMemoryTripService(),
    });

    const response = await GET(request("partner=tripcom&url=https%3A%2F%2Fwww.trip.com%2Fhotels"));

    expect(response.status).toBe(503);
    expect(response.headers.get("location")).toBeNull();
    await expect(response.json()).resolves.toEqual({
      error: "Partner redirects are temporarily unavailable.",
    });
  });
});

function inject(commerceService: CommerceService) {
  setTestWebServerServices({
    commerceService,
    humanTaskService: createInMemoryHumanTaskService(),
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    tripService: createVersionedInMemoryTripService(),
  });
}

function request(query: string) {
  return new Request(`https://example.test/outbound?${query}`);
}
