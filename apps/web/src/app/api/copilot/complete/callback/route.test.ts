import {
  createInMemoryAgentTraceService,
  createInMemoryCompletionJobService,
  createInMemoryHumanTaskService,
  createInMemoryKnowledgeService,
  createVersionedInMemoryTripService,
  type CompletionQueue,
} from "@visepanda/app-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { setTestWebServerServices } from "../../../_server";
import { POST } from "./route";

const tripId = "20000000-0000-0000-0000-000000000001";
const idempotencyKey = "20000000-0000-0000-0000-000000000002";
const identity = { kind: "anonymous" as const, anonId: "callback-owner" };
const originalMode = process.env.VISEPANDA_RUNTIME_MODE;

beforeEach(() => {
  process.env.VISEPANDA_RUNTIME_MODE = "test";
});

afterEach(() => {
  setTestWebServerServices(null);
  vi.restoreAllMocks();
  if (originalMode === undefined) delete process.env.VISEPANDA_RUNTIME_MODE;
  else process.env.VISEPANDA_RUNTIME_MODE = originalMode;
});

describe("completion callback", () => {
  it("rejects an invalid signature before claiming the job", async () => {
    const setup = await createSetup(false);
    const response = await POST(callbackRequest(setup.job.id, "invalid"));

    expect(response.status).toBe(401);
    await expect(setup.jobs.get(setup.job.id, identity)).resolves.toMatchObject({
      state: "queued",
      attempt: 0,
    });
    expect(setup.completeDay).not.toHaveBeenCalled();
  });

  it("processes a signed delivery and duplicate delivery only once", async () => {
    const setup = await createSetup(true);
    const first = await POST(callbackRequest(setup.job.id, "valid"));
    const duplicate = await POST(callbackRequest(setup.job.id, "valid"));

    expect(first.status).toBe(200);
    await expect(first.json()).resolves.toMatchObject({
      ok: true,
      result: { accepted: true, state: "completed" },
    });
    await expect(duplicate.json()).resolves.toMatchObject({
      ok: true,
      result: { accepted: false, state: "duplicate" },
    });
    expect(setup.completeDay).toHaveBeenCalledTimes(1);
  });
});

async function createSetup(signatureValid: boolean) {
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
    verify: vi.fn(async () => signatureValid),
  } satisfies CompletionQueue;
  const completeDay = vi.fn(async () => ({
    id: "completion-day-1",
    type: "attraction" as const,
    title: "Yu Garden",
  }));
  setTestWebServerServices({
    humanTaskService: createInMemoryHumanTaskService(),
    knowledgeService: createInMemoryKnowledgeService(),
    traceService: createInMemoryAgentTraceService(),
    tripService,
    completionJobService: jobs,
    completionQueue: queue,
    completionDay: completeDay,
  });
  return { completeDay, job, jobs };
}

function callbackRequest(jobId: string, signature: string) {
  return new Request("https://preview.example.com/api/copilot/complete/callback", {
    method: "POST",
    headers: { "content-type": "application/json", "upstash-signature": signature },
    body: JSON.stringify({ jobId, idempotencyKey }),
  });
}
