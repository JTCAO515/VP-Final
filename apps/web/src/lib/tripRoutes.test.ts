import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createInMemoryAgentTraceService,
  createInMemoryAnonymousTurnCounter,
  createInMemoryCopilotIpRateLimiter,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
} from "@visepanda/app-server";
import { POST as runCopilot } from "../app/api/copilot/route";
import { findModelFailure } from "../app/api/copilot/modelFailure";
import { DemoModelExecutionError, DemoModelUnavailableError } from "@visepanda/app-server";
import { setTestWebServerServices } from "../app/api/_server";
import { GET as getTrip, PATCH as patchTrip } from "../app/api/trips/[tripId]/route";
import { POST as claimTrips } from "../app/api/trips/claim/route";
import { DELETE as revokeShare, POST as createShare } from "../app/api/trips/[tripId]/share/route";
import { createAnonymousSessionValue } from "./requestIdentity";

const secret = "test-secret-that-is-long-enough-for-route-contracts";
const originalSecret = process.env.VISEPANDA_ANON_SESSION_SECRET;
const originalKeyId = process.env.VISEPANDA_ANON_SESSION_KEY_ID;
const originalRuntimeMode = process.env.VISEPANDA_RUNTIME_MODE;
const originalDatabaseUrl = process.env.DATABASE_URL;
const originalVercel = process.env.VERCEL;

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = secret;
  process.env.VISEPANDA_ANON_SESSION_KEY_ID = "current";
  process.env.VERCEL = "1";
  setTestWebServerServices({
    anonymousTurnCounter: createInMemoryAnonymousTurnCounter(),
    copilotIpRateLimiter: createInMemoryCopilotIpRateLimiter(),
    humanTaskService: createInMemoryHumanTaskService(),
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    tripService: createVersionedInMemoryTripService(),
  });
});

afterEach(() => {
  if (originalRuntimeMode === undefined) delete process.env.VISEPANDA_RUNTIME_MODE;
  else process.env.VISEPANDA_RUNTIME_MODE = originalRuntimeMode;
  if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = originalDatabaseUrl;
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
  setTestWebServerServices(null);
  if (originalSecret === undefined) delete process.env.VISEPANDA_ANON_SESSION_SECRET;
  else process.env.VISEPANDA_ANON_SESSION_SECRET = originalSecret;
  if (originalKeyId === undefined) delete process.env.VISEPANDA_ANON_SESSION_KEY_ID;
  else process.env.VISEPANDA_ANON_SESSION_KEY_ID = originalKeyId;
});

describe("private Trip route authority", () => {
  it("detects model failures through a tRPC-style cause chain", () => {
    const unavailable = new DemoModelUnavailableError(["router_primary"]);
    expect(findModelFailure({ cause: { cause: unavailable } })).toBe(unavailable);

    const exhausted = new DemoModelExecutionError([]);
    expect(findModelFailure({ cause: exhausted })).toBe(exhausted);
  });

  it("returns a typed 503 when deployed durable services are missing", async () => {
    process.env.VISEPANDA_RUNTIME_MODE = "production";
    delete process.env.DATABASE_URL;
    setTestWebServerServices(null);

    const response = await runCopilot(
      jsonRequest("https://example.test/api/copilot", cookieFor("unavailable-runtime"), {
        message: "Plan a Shanghai trip",
      }),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: "RUNTIME_UNAVAILABLE",
    });
  });

  it("rejects a claim without a verified authenticated session", async () => {
    const response = await claimTrips(
      new Request("https://example.test/api/trips/claim", { method: "POST" }),
    );
    expect(response.status).toBe(401);
  });

  it("uses the signed cookie owner and hides the Trip from another anonymous session", async () => {
    const ownerCookie = cookieFor(`owner-${crypto.randomUUID()}`);
    const forgedTripId = crypto.randomUUID();
    const response = await runCopilot(
      jsonRequest("https://example.test/api/copilot", ownerCookie, {
        message: "Plan a 2 day Shanghai trip",
        anonId: "forged-owner",
        currentTrip: {
          id: forgedTripId,
          title: "Forged",
          destinationCountry: "CN",
          days: [],
        },
      }),
    );
    expect(response.status).toBe(200);
    const created = (await response.json()) as {
      ok: true;
      trip: { id: string };
      version: number;
    };
    expect(created).toMatchObject({
      ok: true,
      version: 1,
    });
    expect(created.trip.id).not.toBe(forgedTripId);
    const tripId = created.trip.id;

    const ownerRead = await getTrip(getRequest(tripId, ownerCookie), tripContext(tripId));
    expect(ownerRead.status).toBe(200);
    await expect(ownerRead.json()).resolves.toMatchObject({
      ok: true,
      trip: { id: tripId },
      version: 1,
    });

    const otherRead = await getTrip(
      getRequest(tripId, cookieFor(`other-${tripId}`)),
      tripContext(tripId),
    );
    expect(otherRead.status).toBe(404);
  });

  it("returns a typed 409 for stale patches and supports share revocation", async () => {
    const cookie = cookieFor(`owner-${crypto.randomUUID()}`);
    const created = await runCopilot(
      jsonRequest("https://example.test/api/copilot", cookie, {
        message: "Plan a Shanghai trip",
      }),
    );
    const createdBody = (await created.json()) as {
      ok: true;
      trip: { id: string };
      version: number;
    };
    expect(createdBody).toMatchObject({
      ok: true,
      version: 1,
    });
    const tripId = createdBody.trip.id;

    const firstUpdate = await patchTrip(
      jsonRequest(
        `https://example.test/api/trips/${tripId}`,
        cookie,
        {
          expectedVersion: 1,
          patch: { operations: [{ op: "update_trip", fields: { title: "Accepted" } }] },
        },
        "PATCH",
      ),
      tripContext(tripId),
    );
    expect(firstUpdate.status).toBe(200);

    const stale = await patchTrip(
      jsonRequest(
        `https://example.test/api/trips/${tripId}`,
        cookie,
        {
          expectedVersion: 1,
          patch: { operations: [{ op: "update_trip", fields: { title: "Stale" } }] },
        },
        "PATCH",
      ),
      tripContext(tripId),
    );
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toMatchObject({
      ok: false,
      code: "TRIP_VERSION_CONFLICT",
      currentVersion: 2,
    });

    const shared = await createShare(
      new Request(`https://example.test/api/trips/${tripId}/share`, {
        method: "POST",
        headers: { cookie },
      }),
      tripContext(tripId),
    );
    expect(shared.status).toBe(200);
    await expect(
      revokeShare(
        new Request(`https://example.test/api/trips/${tripId}/share`, {
          method: "DELETE",
          headers: { cookie },
        }),
        tripContext(tripId),
      ),
    ).resolves.toMatchObject({ status: 200 });
  });
});

function cookieFor(anonId: string): string {
  const validAnonId = anonId
    .replace(/[^A-Za-z0-9_-]/g, "")
    .padEnd(43, "x")
    .slice(0, 43);
  return `vp_anon_session=${createAnonymousSessionValue(secret, validAnonId)}`;
}

function getRequest(tripId: string, cookie: string): Request {
  return new Request(`https://example.test/api/trips/${tripId}`, { headers: { cookie } });
}

function jsonRequest(url: string, cookie: string, body: unknown, method = "POST"): Request {
  return new Request(url, {
    method,
    headers: {
      "content-type": "application/json",
      cookie,
      "x-vercel-forwarded-for": "203.0.113.42",
    },
    body: JSON.stringify(body),
  });
}

function tripContext(tripId: string) {
  return { params: Promise.resolve({ tripId }) };
}
