import { CompletionJobSchema, type CompletionJob } from "@visepanda/domain";
import { and, eq, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { copilotCompletionJobs, trips } from "./schema.js";
import type { CompletionJobService } from "../modules/copilot/completionJobService.js";
import type { TripIdentity } from "../modules/trip/versionedService.js";
import { COMPLETION_CLAIM_LEASE_MS } from "../modules/copilot/completionJobService.js";

export function createDbCompletionJobService(db: Db): CompletionJobService {
  return {
    async create(input, identity) {
      return db.transaction(async (tx) => {
        const [trip] = await tx
          .select({ headVersion: trips.headVersion })
          .from(trips)
          .where(and(eq(trips.id, input.tripId), ownerPredicate(identity)))
          .limit(1)
          .for("update");
        if (!trip) throw new Error("Trip not found.");
        if (trip.headVersion !== input.baseVersion) {
          throw new Error("Trip changed before completion was queued.");
        }

        const id = crypto.randomUUID();
        await tx
          .insert(copilotCompletionJobs)
          .values({ id, ...input })
          .onConflictDoNothing({
            target: [copilotCompletionJobs.tripId, copilotCompletionJobs.baseVersion],
          });
        const [row] = await tx
          .select()
          .from(copilotCompletionJobs)
          .where(
            and(
              eq(copilotCompletionJobs.tripId, input.tripId),
              eq(copilotCompletionJobs.baseVersion, input.baseVersion),
            ),
          )
          .limit(1);
        if (!row) throw new Error("Completion job could not be created.");
        return jobFromRow(row);
      });
    },

    async get(id, identity) {
      const [row] = await db
        .select({ job: copilotCompletionJobs })
        .from(copilotCompletionJobs)
        .innerJoin(trips, eq(copilotCompletionJobs.tripId, trips.id))
        .where(and(eq(copilotCompletionJobs.id, id), ownerPredicate(identity)))
        .limit(1);
      return row ? jobFromRow(row.job) : null;
    },

    async claim(id, idempotencyKey) {
      return db.transaction(async (tx) => {
        const now = new Date();
        const staleBefore = new Date(now.getTime() - COMPLETION_CLAIM_LEASE_MS);
        const [job] = await tx
          .update(copilotCompletionJobs)
          .set({
            state: "running",
            attempt: sqlNextAttempt(),
            startedAt: now,
            completedAt: null,
            errorCode: null,
            updatedAt: now,
          })
          .where(
            and(
              eq(copilotCompletionJobs.id, id),
              eq(copilotCompletionJobs.idempotencyKey, idempotencyKey),
              or(
                and(
                  eq(copilotCompletionJobs.state, "queued"),
                  lt(copilotCompletionJobs.attempt, copilotCompletionJobs.maxAttempts),
                ),
                and(
                  eq(copilotCompletionJobs.state, "running"),
                  lte(copilotCompletionJobs.startedAt, staleBefore),
                ),
              ),
            ),
          )
          .returning();
        if (!job) return null;

        const [owner] = await tx
          .select({ owner: trips.owner, anonId: trips.anonId })
          .from(trips)
          .where(eq(trips.id, job.tripId))
          .limit(1);
        if (!owner) throw new Error("Completion job Trip is missing.");
        return { job: jobFromRow(job), identity: identityFromRow(owner) };
      });
    },

    async settle(id, attempt, state, errorCode) {
      const [row] = await db
        .update(copilotCompletionJobs)
        .set({
          state,
          errorCode: errorCode ?? null,
          completedAt: state === "completed" || state === "conflicted" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(copilotCompletionJobs.id, id),
            eq(copilotCompletionJobs.state, "running"),
            eq(copilotCompletionJobs.attempt, attempt),
          ),
        )
        .returning();
      if (!row) return null;

      if (row.attempt >= row.maxAttempts && (state === "partial" || state === "failed")) {
        const [terminal] = await db
          .update(copilotCompletionJobs)
          .set({ completedAt: new Date(), updatedAt: new Date() })
          .where(eq(copilotCompletionJobs.id, row.id))
          .returning();
        return terminal ? jobFromRow(terminal) : null;
      }
      return jobFromRow(row);
    },

    async requeue(id, attempt) {
      const [row] = await db
        .update(copilotCompletionJobs)
        .set({ state: "queued", completedAt: null, updatedAt: new Date() })
        .where(
          and(
            eq(copilotCompletionJobs.id, id),
            eq(copilotCompletionJobs.attempt, attempt),
            inArray(copilotCompletionJobs.state, ["partial", "failed"]),
            lt(copilotCompletionJobs.attempt, copilotCompletionJobs.maxAttempts),
          ),
        )
        .returning();
      return row ? jobFromRow(row) : null;
    },

    async retry(id, idempotencyKey, identity) {
      const [currentRow] = await db
        .select({ job: copilotCompletionJobs })
        .from(copilotCompletionJobs)
        .innerJoin(trips, eq(copilotCompletionJobs.tripId, trips.id))
        .where(and(eq(copilotCompletionJobs.id, id), ownerPredicate(identity)))
        .limit(1);
      const current = currentRow ? jobFromRow(currentRow.job) : null;
      if (!current || current.idempotencyKey !== idempotencyKey) return null;
      if (current.state === "queued") return current;
      const [row] = await db
        .update(copilotCompletionJobs)
        .set({ state: "queued", completedAt: null, updatedAt: new Date() })
        .from(trips)
        .where(
          and(
            eq(copilotCompletionJobs.id, id),
            eq(copilotCompletionJobs.idempotencyKey, idempotencyKey),
            eq(copilotCompletionJobs.tripId, trips.id),
            ownerPredicate(identity),
            inArray(copilotCompletionJobs.state, ["partial", "failed"]),
            lt(copilotCompletionJobs.attempt, copilotCompletionJobs.maxAttempts),
          ),
        )
        .returning();
      return row ? jobFromRow(row) : null;
    },
  };
}

function ownerPredicate(identity: TripIdentity) {
  return identity.kind === "anonymous"
    ? and(eq(trips.anonId, identity.anonId), isNull(trips.owner))!
    : and(eq(trips.owner, identity.userId), isNull(trips.anonId))!;
}

function identityFromRow(row: { owner: string | null; anonId: string | null }): TripIdentity {
  if (row.owner && !row.anonId) return { kind: "authenticated", userId: row.owner };
  if (row.anonId && !row.owner) return { kind: "anonymous", anonId: row.anonId };
  throw new Error("Completion job Trip has invalid ownership.");
}

type CompletionJobRow = typeof copilotCompletionJobs.$inferSelect;

function jobFromRow(row: CompletionJobRow): CompletionJob {
  return CompletionJobSchema.parse({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  });
}

function sqlNextAttempt() {
  return sql`case when ${copilotCompletionJobs.attempt} < ${copilotCompletionJobs.maxAttempts} then ${copilotCompletionJobs.attempt} + 1 else ${copilotCompletionJobs.attempt} end`;
}
