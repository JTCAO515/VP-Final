import {
  HumanTaskSchema,
  HumanTaskTransitionSchema,
  HumanTaskUpdateSchema,
  HumanTaskEvidenceSchema,
  isHumanTaskEvidenceWindowCurrent,
  sanitizeHumanTaskEvidence,
  type HumanTask,
  type HumanTaskTransition,
  type HumanTaskEvidence,
} from "@visepanda/domain";
import { and, asc, count, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import {
  humanTaskEvidence,
  humanTaskTransitions,
  humanTasks,
  opsAuditEvents,
  users,
} from "./schema.js";
import {
  HUMAN_TASK_DAILY_CAPACITY,
  HumanTaskCapacityError,
  HumanTaskIdempotencyConflictError,
  HumanTaskNotFoundError,
  HumanTaskTransitionForbiddenError,
  HumanTaskEvidencePolicyError,
  chinaDayKey,
  prepareHumanTaskTransition,
  validateHumanTaskPreviewRequest,
  type HumanTaskIdentity,
  type HumanTaskService,
} from "../modules/task/service.js";

export function createDbHumanTaskService(db: Db, options?: { now?: () => Date }): HumanTaskService {
  const now = options?.now ?? (() => new Date());

  return {
    async create(input) {
      const request = validateHumanTaskPreviewRequest(input.request);
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`human-task-idempotency:${input.idempotencyKey}`}, 0))`,
        );
        const [replay] = await tx
          .select()
          .from(humanTasks)
          .where(eq(humanTasks.idempotencyKey, input.idempotencyKey))
          .limit(1);
        if (replay) {
          if (!rowBelongsTo(replay, input.identity) || !rowMatchesRequest(replay, request)) {
            throw new HumanTaskIdempotencyConflictError();
          }
          return taskFromRow(replay);
        }

        const requestedAt = now();
        const bounds = chinaDayBounds(requestedAt);
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`human-task-capacity:${bounds.key}`}, 0))`,
        );
        const [daily] = await tx
          .select({ value: count() })
          .from(humanTasks)
          .where(
            and(gte(humanTasks.createdAt, bounds.start), lt(humanTasks.createdAt, bounds.end)),
          );
        if ((daily?.value ?? 0) >= HUMAN_TASK_DAILY_CAPACITY) {
          throw new HumanTaskCapacityError();
        }

        await ensureAuthenticatedUser(tx, input.identity);
        const [created] = await tx
          .insert(humanTasks)
          .values({
            ...ownerValues(input.identity),
            idempotencyKey: input.idempotencyKey,
            city: request.city,
            kind: request.kind,
            description: request.description,
            contact: request.contact,
            status: "requested",
            createdAt: requestedAt,
            updatedAt: requestedAt,
          })
          .returning();
        if (!created) throw new Error("Human Task insert returned no record");
        return taskFromRow(created);
      });
    },

    async listForOwner(identity) {
      const rows = await db
        .select()
        .from(humanTasks)
        .where(ownerPredicate(identity))
        .orderBy(desc(humanTasks.createdAt));
      return rows.map(taskFromRow);
    },

    async listForOps() {
      const rows = await db.select().from(humanTasks).orderBy(desc(humanTasks.createdAt));
      return rows.map(taskFromRow);
    },

    async getForOps(taskId, actor) {
      if (!actor.permissions.includes("task.contact.read")) {
        throw new HumanTaskTransitionForbiddenError();
      }
      const [row] = await db.select().from(humanTasks).where(eq(humanTasks.id, taskId)).limit(1);
      if (!row) throw new HumanTaskNotFoundError();
      return taskFromRow(row);
    },

    async updateOperatorNote(input) {
      if (!input.actor.permissions.includes("task.write")) {
        throw new HumanTaskTransitionForbiddenError();
      }
      const update = HumanTaskUpdateSchema.parse({
        id: input.taskId,
        operator_note: input.note,
      });
      return db.transaction(async (tx) => {
        const [row] = await tx
          .update(humanTasks)
          .set({ operatorNote: update.operator_note, updatedAt: now() })
          .where(eq(humanTasks.id, input.taskId))
          .returning();
        if (!row) throw new HumanTaskNotFoundError();
        await tx.insert(opsAuditEvents).values({
          actorId: input.actor.userId,
          action: "human_task.note.updated",
          targetType: "human_task",
          targetId: input.taskId,
          metadataJsonb: { notePresent: update.operator_note !== null },
        });
        return taskFromRow(row);
      });
    },

    async appendEvidence(input) {
      if (!input.actor.permissions.includes("task.write")) {
        throw new HumanTaskTransitionForbiddenError();
      }
      const sanitized = sanitizeHumanTaskEvidence(input.evidence);
      return db.transaction(async (tx) => {
        const [task] = await tx
          .select()
          .from(humanTasks)
          .where(eq(humanTasks.id, input.taskId))
          .limit(1);
        if (!task || !isHumanTaskEvidenceWindowCurrent(taskFromRow(task), now())) {
          throw new HumanTaskEvidencePolicyError();
        }
        const [row] = await tx
          .insert(humanTaskEvidence)
          .values({
            taskId: input.taskId,
            kind: input.evidence.kind,
            content: sanitized.content,
            redactionClassesJsonb: sanitized.redactionClasses,
            actorId: input.actor.userId,
            createdAt: now(),
          })
          .returning();
        if (!row) throw new Error("Human Task evidence insert failed.");
        await tx.insert(opsAuditEvents).values({
          actorId: input.actor.userId,
          action: "human_task.evidence.appended",
          targetType: "human_task_evidence",
          targetId: row.id,
          metadataJsonb: { taskId: input.taskId, kind: input.evidence.kind },
        });
        return evidenceFromRow(row);
      });
    },

    async listEvidence(taskId, actor) {
      if (!actor.permissions.includes("task.contact.read")) {
        throw new HumanTaskTransitionForbiddenError();
      }
      const [task] = await db.select().from(humanTasks).where(eq(humanTasks.id, taskId)).limit(1);
      if (!task) throw new HumanTaskNotFoundError();
      if (!isHumanTaskEvidenceWindowCurrent(taskFromRow(task), now())) return [];
      return (
        await db
          .select()
          .from(humanTaskEvidence)
          .where(eq(humanTaskEvidence.taskId, taskId))
          .orderBy(asc(humanTaskEvidence.createdAt))
      ).map(evidenceFromRow);
    },

    async transition(input) {
      return db.transaction(async (tx) => {
        const [row] = await tx
          .select()
          .from(humanTasks)
          .where(eq(humanTasks.id, input.taskId))
          .for("update")
          .limit(1);
        if (!row) throw new HumanTaskNotFoundError();

        const prepared = prepareHumanTaskTransition(taskFromRow(row), input, now());
        const [updated] = await tx
          .update(humanTasks)
          .set({
            status: prepared.task.status,
            retentionExpiresAt: prepared.task.retention_expires_at
              ? new Date(prepared.task.retention_expires_at)
              : null,
            updatedAt: new Date(prepared.task.updated_at),
          })
          .where(eq(humanTasks.id, input.taskId))
          .returning();
        if (!updated) throw new HumanTaskNotFoundError();

        const [transition] = await tx
          .insert(humanTaskTransitions)
          .values({
            id: prepared.transition.id,
            taskId: input.taskId,
            fromStatus: prepared.transition.from_status,
            toStatus: prepared.transition.to_status,
            actorId: prepared.transition.actor_id,
            reason: prepared.transition.reason,
            createdAt: new Date(prepared.transition.created_at),
          })
          .returning();
        if (!transition) throw new Error("Human Task transition insert returned no record");
        return { task: taskFromRow(updated), transition: transitionFromRow(transition) };
      });
    },

    async listTransitions(taskId, actor) {
      if (!actor.permissions.includes("task.read")) {
        throw new HumanTaskTransitionForbiddenError();
      }
      const rows = await db
        .select()
        .from(humanTaskTransitions)
        .where(eq(humanTaskTransitions.taskId, taskId))
        .orderBy(asc(humanTaskTransitions.createdAt));
      return rows.map(transitionFromRow);
    },
  };
}

function ownerPredicate(identity: HumanTaskIdentity) {
  return identity.kind === "anonymous"
    ? and(eq(humanTasks.anonId, identity.anonId), isNull(humanTasks.userId))!
    : and(eq(humanTasks.userId, identity.userId), isNull(humanTasks.anonId))!;
}

function ownerValues(identity: HumanTaskIdentity) {
  return identity.kind === "anonymous"
    ? { userId: null, anonId: identity.anonId }
    : { userId: identity.userId, anonId: null };
}

function rowBelongsTo(
  row: { userId: string | null; anonId: string | null },
  identity: HumanTaskIdentity,
): boolean {
  return identity.kind === "anonymous"
    ? row.userId === null && row.anonId === identity.anonId
    : row.anonId === null && row.userId === identity.userId;
}

function rowMatchesRequest(
  row: { city: string; kind: string; description: string; contact: string },
  request: { city: string; kind: string; description: string; contact: string },
): boolean {
  return (
    row.city === request.city &&
    row.kind === request.kind &&
    row.description === request.description &&
    row.contact === request.contact
  );
}

async function ensureAuthenticatedUser(db: Pick<Db, "insert">, identity: HumanTaskIdentity) {
  if (identity.kind !== "authenticated") return;
  await db
    .insert(users)
    .values({ id: identity.userId, ...(identity.email ? { email: identity.email } : {}) })
    .onConflictDoNothing();
}

function chinaDayBounds(now: Date): { key: string; start: Date; end: Date } {
  const key = chinaDayKey(now);
  const start = new Date(`${key}T00:00:00.000+08:00`);
  return { key, start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

function taskFromRow(row: typeof humanTasks.$inferSelect): HumanTask {
  return HumanTaskSchema.parse({
    id: row.id,
    city: row.city,
    kind: row.kind,
    description: row.description,
    contact: row.contact,
    status: row.status,
    price_usd: row.priceUsd === null ? null : Number(row.priceUsd),
    payment_link: row.paymentLink,
    operator_note: row.operatorNote,
    retention_expires_at: row.retentionExpiresAt?.toISOString() ?? null,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  });
}

function transitionFromRow(row: typeof humanTaskTransitions.$inferSelect): HumanTaskTransition {
  return HumanTaskTransitionSchema.parse({
    id: row.id,
    task_id: row.taskId,
    from_status: row.fromStatus,
    to_status: row.toStatus,
    actor_id: row.actorId,
    reason: row.reason,
    created_at: row.createdAt.toISOString(),
  });
}

function evidenceFromRow(row: typeof humanTaskEvidence.$inferSelect): HumanTaskEvidence {
  return HumanTaskEvidenceSchema.parse({
    id: row.id,
    task_id: row.taskId,
    kind: row.kind,
    content: row.content,
    redaction_classes: row.redactionClassesJsonb,
    actor_id: row.actorId,
    created_at: row.createdAt.toISOString(),
  });
}
