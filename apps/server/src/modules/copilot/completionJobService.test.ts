import { describe, expect, it } from "vitest";
import { createVersionedInMemoryTripService } from "../trip/versionedService.js";
import { createInMemoryCompletionJobService } from "./completionJobService.js";

const tripId = "20000000-0000-0000-0000-000000000001";
const identity = { kind: "anonymous" as const, anonId: "completion-owner" };
const otherIdentity = { kind: "anonymous" as const, anonId: "not-owner" };

async function setup() {
  const trips = createVersionedInMemoryTripService();
  await trips.create(
    {
      id: tripId,
      title: "Shanghai shell",
      destinationCountry: "CN",
      days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", blocks: [] }],
    },
    identity,
    "ai_copilot",
  );
  return { trips, jobs: createInMemoryCompletionJobService(trips) };
}

describe("CompletionJobService", () => {
  it("creates one owner-scoped job per trip version", async () => {
    const { jobs } = await setup();
    const input = {
      tripId,
      baseVersion: 1,
      idempotencyKey: "20000000-0000-0000-0000-000000000002",
      maxAttempts: 2,
    };

    const first = await jobs.create(input, identity);
    const duplicate = await jobs.create(
      { ...input, idempotencyKey: "20000000-0000-0000-0000-000000000003" },
      identity,
    );

    expect(duplicate).toEqual(first);
    await expect(jobs.get(first.id, otherIdentity)).resolves.toBeNull();
    await expect(jobs.create(input, otherIdentity)).rejects.toThrow("Trip not found");
  });

  it("claims atomically and bounds retries", async () => {
    const { jobs } = await setup();
    const job = await jobs.create(
      {
        tripId,
        baseVersion: 1,
        idempotencyKey: "20000000-0000-0000-0000-000000000002",
        maxAttempts: 2,
      },
      identity,
    );

    const [first, duplicate] = await Promise.all([
      jobs.claim(job.id, job.idempotencyKey),
      jobs.claim(job.id, job.idempotencyKey),
    ]);
    expect([first, duplicate].filter(Boolean)).toHaveLength(1);
    expect(first?.job.attempt ?? duplicate?.job.attempt).toBe(1);

    await jobs.settle(job.id, 1, "failed", "provider_unavailable");
    await expect(jobs.requeue(job.id, 1)).resolves.toMatchObject({ state: "queued" });
    await expect(jobs.claim(job.id, job.idempotencyKey)).resolves.toMatchObject({
      job: { state: "running", attempt: 2 },
    });
    await jobs.settle(job.id, 2, "failed", "provider_unavailable");
    await expect(jobs.requeue(job.id, 2)).resolves.toBeNull();
    await expect(jobs.get(job.id, identity)).resolves.toMatchObject({
      state: "failed",
      attempt: 2,
    });
  });

  it("reclaims only an expired running attempt", async () => {
    let clock = new Date("2026-07-16T00:00:00.000Z");
    const trips = createVersionedInMemoryTripService();
    await trips.create(
      {
        id: tripId,
        title: "Shanghai shell",
        destinationCountry: "CN",
        days: [],
      },
      identity,
      "ai_copilot",
    );
    const jobs = createInMemoryCompletionJobService(trips, {
      now: () => clock,
      claimLeaseMs: 60_000,
    });
    const job = await jobs.create(
      {
        tripId,
        baseVersion: 1,
        idempotencyKey: "20000000-0000-0000-0000-000000000002",
        maxAttempts: 2,
      },
      identity,
    );
    await expect(jobs.claim(job.id, job.idempotencyKey)).resolves.toMatchObject({
      job: { attempt: 1 },
    });
    await expect(jobs.claim(job.id, job.idempotencyKey)).resolves.toBeNull();

    clock = new Date("2026-07-16T00:01:01.000Z");
    await expect(jobs.claim(job.id, job.idempotencyKey)).resolves.toMatchObject({
      job: { state: "running", attempt: 2 },
    });
  });
});
