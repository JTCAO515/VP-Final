import {
  createInMemoryAgentTraceService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createInMemoryReadinessService,
  createVersionedInMemoryTripService,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setTestWebServerServices } from "../_server";
import { GET, POST } from "./route";

const trip = {
  id: "550e8400-e29b-41d4-a716-446655440021",
  title: "Shanghai preparation",
  destinationCountry: "CN" as const,
  days: [],
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

describe("Readiness HTTP boundary", () => {
  it("persists only explicit fixed-enum answers through an owned anonymous Trip", async () => {
    const tripService = createVersionedInMemoryTripService();
    const readinessService = createInMemoryReadinessService({ tripService });
    inject(tripService, readinessService);

    const first = await POST(postRequest(validBody(trip.id)));
    const cookie = first.headers.get("set-cookie")?.split(";", 1)[0];
    expect(first.status).toBe(404);
    expect(await first.json()).toMatchObject({ ok: false, error: expect.stringContaining("Trip") });

    // Establish the exact anonymous owner represented by the signed cookie before retrying.
    const cookieValue = cookie?.split("=", 2)[1];
    expect(cookieValue).toBeTruthy();
    const anonId = decodeAnonymousId(cookieValue!);
    await tripService.create(trip, { kind: "anonymous", anonId }, "user_manual");

    const saved = await POST(postRequest(validBody(trip.id), cookie));
    expect(saved.status).toBe(200);
    await expect(saved.json()).resolves.toMatchObject({
      ok: true,
      assessment: {
        tripId: trip.id,
        assessment: { answers: [{ questionId: "payment_method", value: "confirmed" }] },
      },
    });

    const latest = await GET(getRequest(trip.id, cookie));
    expect(latest.status).toBe(200);
    await expect(latest.json()).resolves.toMatchObject({
      ok: true,
      assessment: { tripId: trip.id, result: { items: expect.any(Array) } },
    });
  });

  it("rejects free-form fields and missing persistence consent without writing a record", async () => {
    const tripService = createVersionedInMemoryTripService();
    inject(tripService, createInMemoryReadinessService({ tripService }));

    const withNarrative = await POST(
      postRequest({
        ...validBody(),
        assessment: { ...validBody().assessment, note: "passport number 123456" },
      }),
    );
    const noConsent = await POST(
      postRequest({
        assessment: { version: 1, answers: [], persistenceConsent: "not_requested" },
      }),
    );

    expect(withNarrative.status).toBe(400);
    expect(noConsent.status).toBe(400);
    expect(JSON.stringify(await withNarrative.json())).not.toContain("passport number");
  });

  it("does not disclose another owner's saved assessment", async () => {
    const tripService = createVersionedInMemoryTripService();
    const readinessService = createInMemoryReadinessService({ tripService });
    inject(tripService, readinessService);

    const ownerCookie = await cookieFromFirstRequest();
    const ownerId = decodeAnonymousId(ownerCookie.split("=", 2)[1]!);
    await tripService.create(trip, { kind: "anonymous", anonId: ownerId }, "user_manual");
    await POST(postRequest(validBody(trip.id), ownerCookie));

    const stranger = await GET(getRequest(trip.id));
    expect(stranger.status).toBe(404);
    await expect(stranger.json()).resolves.toEqual({
      ok: false,
      error: "The selected Trip is unavailable. Your self-report was not saved.",
    });
  });
});

function inject(
  tripService: ReturnType<typeof createVersionedInMemoryTripService>,
  readinessService: ReturnType<typeof createInMemoryReadinessService>,
) {
  setTestWebServerServices({
    humanTaskService: createInMemoryHumanTaskService(),
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    tripService,
    readinessService,
  });
}

function validBody(tripId?: string) {
  return {
    assessment: {
      version: 1,
      answers: [{ questionId: "payment_method", value: "confirmed" }],
      persistenceConsent: "granted",
    },
    ...(tripId ? { tripId } : {}),
  };
}

function postRequest(body: unknown, cookie?: string) {
  return new Request("https://example.test/api/readiness", {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
}

function getRequest(tripId: string, cookie?: string) {
  return new Request(`https://example.test/api/readiness?tripId=${tripId}`, {
    headers: cookie ? { cookie } : {},
  });
}

async function cookieFromFirstRequest(): Promise<string> {
  const response = await POST(postRequest(validBody(trip.id)));
  const cookie = response.headers.get("set-cookie")?.split(";", 1)[0];
  if (!cookie) throw new Error("Expected an anonymous identity cookie");
  return cookie;
}

function decodeAnonymousId(cookieValue: string): string {
  const [, encoded] = cookieValue.split(".");
  if (!encoded) throw new Error("Expected a signed anonymous session value");
  return encoded;
}
