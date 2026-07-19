import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./schema.js";
import { createDbCompletionJobService } from "./completionJobService.js";
import { createDbVersionedTripService } from "./versionedTripService.js";
import { createCompletionProcessor } from "../modules/copilot/completionProcessor.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const tripId = "21000000-0000-0000-0000-000000000001";
const idempotencyKey = "21000000-0000-0000-0000-000000000002";
const identity = { kind: "anonymous" as const, anonId: "durable-completion-owner" };

describeDatabase("database CompletionJobService", () => {
  const sql = postgres(databaseUrl!);
  const db = drizzle(sql, { schema });
  const trips = createDbVersionedTripService(db);

  beforeEach(async () => {
    await sql`delete from public.trips where id = ${tripId}`;
    await trips.create(
      {
        id: tripId,
        title: "Durable shell",
        destinationCountry: "CN",
        days: [{ id: "day-1", dayNumber: 1, city: "Shanghai", blocks: [] }],
      },
      identity,
      "ai_copilot",
    );
  });

  afterAll(async () => {
    await sql`delete from public.trips where id = ${tripId}`;
    await sql.end();
  });

  it("persists across service instances and atomically claims once", async () => {
    const firstInstance = createDbCompletionJobService(db);
    const job = await firstInstance.create(
      { tripId, baseVersion: 1, idempotencyKey, maxAttempts: 2 },
      identity,
    );

    const secondInstance = createDbCompletionJobService(db);
    await expect(secondInstance.get(job.id, identity)).resolves.toEqual(job);
    const claims = await Promise.all([
      firstInstance.claim(job.id, idempotencyKey),
      secondInstance.claim(job.id, idempotencyKey),
    ]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    await expect(secondInstance.get(job.id, identity)).resolves.toMatchObject({
      state: "running",
      attempt: 1,
    });
  });

  it("returns the same job for duplicate trip and base version", async () => {
    const service = createDbCompletionJobService(db);
    const first = await service.create(
      { tripId, baseVersion: 1, idempotencyKey, maxAttempts: 2 },
      identity,
    );
    const duplicate = await service.create(
      {
        tripId,
        baseVersion: 1,
        idempotencyKey: "21000000-0000-0000-0000-000000000003",
        maxAttempts: 2,
      },
      identity,
    );

    expect(duplicate).toEqual(first);
  });

  it("persists one completion event across duplicate durable delivery", async () => {
    const jobs = createDbCompletionJobService(db);
    const job = await jobs.create(
      { tripId, baseVersion: 1, idempotencyKey, maxAttempts: 2 },
      identity,
    );
    const processor = createCompletionProcessor({
      jobService: jobs,
      tripService: trips,
      queue: { publish: async () => undefined, verify: async () => true },
      completeDay: async (day) => ({
        id: `completion-${day.id}`,
        type: "attraction",
        title: "Yu Garden",
      }),
    });
    const payload = { jobId: job.id, idempotencyKey };

    await expect(processor.process(payload)).resolves.toMatchObject({ state: "completed" });
    await expect(processor.process(payload)).resolves.toMatchObject({ state: "duplicate" });
    await expect(trips.getEvents(tripId, identity)).resolves.toHaveLength(2);
  });

  it("recovers an expired running job after its Patch was persisted", async () => {
    const firstInstance = createDbCompletionJobService(db);
    const job = await firstInstance.create(
      { tripId, baseVersion: 1, idempotencyKey, maxAttempts: 1 },
      identity,
    );
    await firstInstance.claim(job.id, idempotencyKey);
    await trips.apply({
      id: tripId,
      identity,
      expectedVersion: 1,
      patch: {
        operations: [
          {
            op: "upsert_block",
            dayId: "day-1",
            block: { id: "completion-day-1", type: "attraction", title: "Yu Garden" },
          },
        ],
      },
      source: "ai_copilot",
      completion: { jobId: job.id, attempt: 1 },
    });
    await sql`
      update public.copilot_completion_jobs
      set started_at = now() - interval '11 minutes'
      where id = ${job.id}
    `;

    const secondInstance = createDbCompletionJobService(db);
    const completeDay = vi.fn(async () => {
      throw new Error("must not regenerate an already persisted day");
    });
    const processor = createCompletionProcessor({
      jobService: secondInstance,
      tripService: trips,
      queue: { publish: async () => undefined, verify: async () => true },
      completeDay,
    });

    await expect(processor.process({ jobId: job.id, idempotencyKey })).resolves.toMatchObject({
      state: "completed",
    });
    expect(completeDay).not.toHaveBeenCalled();
    await expect(secondInstance.get(job.id, identity)).resolves.toMatchObject({
      state: "completed",
      attempt: 1,
    });
    await expect(trips.getEvents(tripId, identity)).resolves.toHaveLength(2);
  });
});
