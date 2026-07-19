import { createAnonymousSessionValue } from "../../../../lib/requestIdentity";
import {
  createInMemoryAgentTraceService,
  createInMemoryCompletionJobService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  type CompletionQueue,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestWebServerServices } from "../../_server";
import { GET, PATCH } from "./route";

const tripId = "20000000-0000-4000-8000-000000000001";
const idempotencyKey = "20000000-0000-4000-8000-000000000002";
const secret = "completion-route-test-secret";
const identity = { kind: "anonymous" as const, anonId: "a".repeat(43) };

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
  process.env.VISEPANDA_ANON_SESSION_SECRET = secret;
});

afterEach(() => {
  delete process.env.VISEPANDA_RUNTIME_MODE;
  delete process.env.VISEPANDA_ANON_SESSION_SECRET;
  setTestWebServerServices(null);
  vi.restoreAllMocks();
});

describe("completion status and retry routes", () => {
  it("returns an owner-scoped status and hides it from another anonymous session", async () => {
    const setup = await createSetup();
    const owned = await GET(statusRequest(setup.job.id, identity.anonId));
    const other = await GET(statusRequest(setup.job.id, "b".repeat(43)));

    expect(owned.status).toBe(200);
    await expect(owned.json()).resolves.toMatchObject({
      ok: true,
      job: { id: setup.job.id, state: "queued" },
    });
    expect(other.status).toBe(404);
  });

  it("retries a failed job once and republishes the persisted reference", async () => {
    const setup = await createSetup();
    await setup.jobs.claim(setup.job.id, setup.job.idempotencyKey);
    await setup.jobs.settle(setup.job.id, 1, "failed", "provider_unavailable");

    const response = await PATCH(retryRequest(setup.job.id, identity.anonId));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      job: { id: setup.job.id, state: "queued", attempt: 1 },
    });
    expect(setup.queue.publish).toHaveBeenCalledWith({ jobId: setup.job.id, idempotencyKey }, 2);
  });
});

async function createSetup() {
  const tripService = createVersionedInMemoryTripService();
  await tripService.create(
    {
      id: tripId,
      title: "Shanghai shell",
      destinationCountry: "CN",
      days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", blocks: [] }],
    },
    identity,
    "ai_copilot",
  );
  const jobs = createInMemoryCompletionJobService(tripService);
  const job = await jobs.create(
    { tripId, baseVersion: 1, idempotencyKey, maxAttempts: 2 },
    identity,
  );
  const queue = {
    publish: vi.fn(async () => undefined),
    verify: vi.fn(async () => true),
  } satisfies CompletionQueue;
  setTestWebServerServices({
    humanTaskService: createInMemoryHumanTaskService(),
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    tripService,
    completionJobService: jobs,
    completionQueue: queue,
  });
  return { job, jobs, queue };
}

function statusRequest(jobId: string, anonId: string) {
  return new Request(`https://example.test/api/copilot/complete?id=${jobId}`, {
    headers: { cookie: cookie(anonId) },
  });
}

function retryRequest(jobId: string, anonId: string) {
  return new Request("https://example.test/api/copilot/complete", {
    method: "PATCH",
    headers: { "content-type": "application/json", cookie: cookie(anonId) },
    body: JSON.stringify({ id: jobId, idempotencyKey }),
  });
}

function cookie(anonId: string) {
  return `vp_anon_session=${createAnonymousSessionValue(secret, anonId)}`;
}
