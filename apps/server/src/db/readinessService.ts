import {
  ChinaReadinessPersistenceRequestSchema,
  ChinaReadinessSavedAssessmentSchema,
  deriveChinaReadinessResult,
  type ChinaReadinessSavedAssessment,
} from "@visepanda/domain";
import { and, desc, eq, isNull, sql, type SQL } from "drizzle-orm";
import type { Db } from "./client.js";
import { readinessAssessments, trips, users } from "./schema.js";
import {
  DEFAULT_READINESS_RETENTION_DAYS,
  ReadinessTripNotFoundError,
  ReadinessTripRequiredError,
  type ReadinessIdentity,
  type ReadinessService,
} from "../modules/readiness/service.js";

export function createDbReadinessService(
  db: Db,
  options: { now?: () => Date; retentionDays?: number } = {},
): ReadinessService {
  const now = options.now ?? (() => new Date());
  const retentionDays = options.retentionDays ?? DEFAULT_READINESS_RETENTION_DAYS;
  return {
    async save(input, identity) {
      const parsed = ChinaReadinessPersistenceRequestSchema.parse(input);
      const savedAt = now();
      const result = deriveChinaReadinessResult(parsed.assessment);
      return db.transaction(async (tx) => {
        await assertDbTripAccess(tx, identity, parsed.tripId);
        await ensureAuthenticatedUser(tx, identity);
        const [row] = await tx
          .insert(readinessAssessments)
          .values({
            userId: identity.kind === "authenticated" ? identity.userId : null,
            tripId: parsed.tripId ?? null,
            assessmentJsonb: parsed.assessment,
            resultJsonb: result,
            consentedAt: savedAt,
            createdAt: savedAt,
            retentionExpiresAt: retentionDeadline(savedAt, retentionDays),
          })
          .returning();
        if (!row) throw new Error("Readiness insert returned no record");
        return savedRecordFromRow(row);
      });
    },

    async latest(identity, input) {
      await assertDbTripAccess(db, identity, input?.tripId);
      if (identity.kind === "anonymous") {
        if (!input?.tripId) return null;
        return latestRecord(
          db,
          and(
            eq(readinessAssessments.tripId, input.tripId),
            sql`${readinessAssessments.retentionExpiresAt} > now()`,
          )!,
        );
      }
      const where = input?.tripId
        ? eq(readinessAssessments.tripId, input.tripId)
        : and(
            eq(readinessAssessments.userId, identity.userId),
            isNull(readinessAssessments.tripId),
          );
      return latestRecord(
        db,
        and(where!, sql`${readinessAssessments.retentionExpiresAt} > now()`)!,
      );
    },
  };
}

function retentionDeadline(createdAt: Date, retentionDays: number): Date {
  return new Date(createdAt.getTime() + retentionDays * 24 * 60 * 60 * 1000);
}

async function latestRecord(db: Pick<Db, "select">, where: SQL<unknown>) {
  const [row] = await db
    .select()
    .from(readinessAssessments)
    .where(where)
    .orderBy(desc(readinessAssessments.createdAt))
    .limit(1);
  return row ? savedRecordFromRow(row) : null;
}

async function assertDbTripAccess(
  db: Pick<Db, "select">,
  identity: ReadinessIdentity,
  tripId: string | undefined,
): Promise<void> {
  if (!tripId) {
    if (identity.kind === "anonymous") throw new ReadinessTripRequiredError();
    return;
  }
  const [trip] = await db
    .select({ id: trips.id })
    .from(trips)
    .where(and(eq(trips.id, tripId), tripOwnerPredicate(identity)))
    .limit(1);
  if (!trip) throw new ReadinessTripNotFoundError();
}

function tripOwnerPredicate(identity: ReadinessIdentity) {
  return identity.kind === "anonymous"
    ? and(eq(trips.anonId, identity.anonId), isNull(trips.owner))!
    : and(eq(trips.owner, identity.userId), isNull(trips.anonId))!;
}

async function ensureAuthenticatedUser(db: Pick<Db, "insert">, identity: ReadinessIdentity) {
  if (identity.kind !== "authenticated") return;
  await db
    .insert(users)
    .values({ id: identity.userId, ...(identity.email ? { email: identity.email } : {}) })
    .onConflictDoNothing();
}

function savedRecordFromRow(
  row: typeof readinessAssessments.$inferSelect,
): ChinaReadinessSavedAssessment {
  return ChinaReadinessSavedAssessmentSchema.parse({
    id: row.id,
    assessment: row.assessmentJsonb,
    result: row.resultJsonb,
    ...(row.tripId ? { tripId: row.tripId } : {}),
    savedAt: row.createdAt.toISOString(),
  });
}
