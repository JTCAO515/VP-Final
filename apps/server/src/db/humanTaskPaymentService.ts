import {
  HumanTaskPaymentSchema,
  HumanTaskSchema,
  HumanTaskTransitionSchema,
  type HumanTask,
  type HumanTaskPayment,
} from "@visepanda/domain";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "./client.js";
import { humanTaskPayments, humanTaskTransitions, humanTasks, opsAuditEvents } from "./schema.js";
import type { OpsAccess } from "../modules/opsAuthorization/service.js";
import type { StripeCheckoutGateway } from "../modules/task/stripeCheckout.js";
import {
  HumanTaskNotFoundError,
  HumanTaskTransitionForbiddenError,
} from "../modules/task/service.js";

const CreateHumanTaskCheckoutSchema = z
  .object({
    task_id: z.string().uuid(),
    amount_cents: z.number().int().positive().max(100_000_000),
  })
  .strict();

export type CreateHumanTaskCheckoutCommand = {
  taskId: string;
  amountCents: number;
  actor: OpsAccess;
};

export type HumanTaskPaymentCheckoutResult = {
  task: HumanTask;
  payment: HumanTaskPayment;
  replayed: boolean;
};

export type HumanTaskPaymentCheckoutService = {
  createCheckout(input: CreateHumanTaskCheckoutCommand): Promise<HumanTaskPaymentCheckoutResult>;
};

export class HumanTaskPaymentStateError extends Error {
  readonly code = "HUMAN_TASK_PAYMENT_STATE_INVALID";

  constructor() {
    super("A payment checkout can be created only for a quoted Human Task.");
    this.name = "HumanTaskPaymentStateError";
  }
}

export class HumanTaskPaymentAmountConflictError extends Error {
  readonly code = "HUMAN_TASK_PAYMENT_AMOUNT_CONFLICT";

  constructor() {
    super("This Human Task already has a payment checkout for a different amount.");
    this.name = "HumanTaskPaymentAmountConflictError";
  }
}

/**
 * Durable, Ops-only checkout writer. The external request deliberately occurs inside the locked
 * task transaction: retrying a provider request outside the lock could create two sessions for one
 * task. A database rollback can leave an unreachable provider session, but never a payment_pending
 * task or a traveler-visible payment link without the matching private ledger row.
 */
export function createDbHumanTaskPaymentCheckoutService(
  db: Db,
  options: {
    gateway: StripeCheckoutGateway;
    retentionDays: number;
    now?: () => Date;
  },
): HumanTaskPaymentCheckoutService {
  const now = options.now ?? (() => new Date());
  const retentionDays = assertRetentionDays(options.retentionDays);

  return {
    async createCheckout(input) {
      assertPaymentPermission(input.actor);
      const command = CreateHumanTaskCheckoutSchema.parse({
        task_id: input.taskId,
        amount_cents: input.amountCents,
      });

      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`human-task-payment:${command.task_id}`}, 0))`,
        );
        const [taskRow] = await tx
          .select()
          .from(humanTasks)
          .where(eq(humanTasks.id, command.task_id))
          .for("update")
          .limit(1);
        if (!taskRow) throw new HumanTaskNotFoundError();

        const [existingPayment] = await tx
          .select()
          .from(humanTaskPayments)
          .where(eq(humanTaskPayments.taskId, command.task_id))
          .limit(1);
        if (existingPayment) {
          if (existingPayment.amountCents !== command.amount_cents) {
            throw new HumanTaskPaymentAmountConflictError();
          }
          if (taskRow.status !== "payment_pending") throw new HumanTaskPaymentStateError();
          return {
            task: taskFromRow(taskRow),
            payment: paymentFromRow(existingPayment),
            replayed: true,
          };
        }

        if (taskRow.status !== "quoted") throw new HumanTaskPaymentStateError();

        const checkout = await options.gateway.createSession({
          taskId: command.task_id,
          amountCents: command.amount_cents,
        });
        const timestamp = now();
        const retentionExpiresAt = new Date(
          timestamp.getTime() + retentionDays * 24 * 60 * 60 * 1_000,
        );
        const [paymentRow] = await tx
          .insert(humanTaskPayments)
          .values({
            taskId: command.task_id,
            provider: "stripe",
            providerCheckoutSessionId: checkout.id,
            amountCents: command.amount_cents,
            currency: "usd",
            checkoutUrl: checkout.url,
            status: "checkout_open",
            retentionExpiresAt,
            createdAt: timestamp,
            updatedAt: timestamp,
          })
          .returning();
        if (!paymentRow) throw new Error("Human Task payment insert returned no record.");

        const [updatedTask] = await tx
          .update(humanTasks)
          .set({
            status: "payment_pending",
            priceUsd: centsToUsd(command.amount_cents),
            paymentLink: checkout.url,
            updatedAt: timestamp,
          })
          .where(and(eq(humanTasks.id, command.task_id), eq(humanTasks.status, "quoted")))
          .returning();
        if (!updatedTask) throw new HumanTaskPaymentStateError();

        await tx.insert(humanTaskTransitions).values({
          id: crypto.randomUUID(),
          taskId: command.task_id,
          fromStatus: "quoted",
          toStatus: "payment_pending",
          actorId: input.actor.userId,
          reason: "A verified Ops checkout was created for the approved Human Task quote.",
          createdAt: timestamp,
        });
        await tx.insert(opsAuditEvents).values({
          actorId: input.actor.userId,
          action: "human_task.payment.checkout_created",
          targetType: "human_task_payment",
          targetId: paymentRow.id,
          metadataJsonb: {
            taskId: command.task_id,
            provider: "stripe",
            amountCents: command.amount_cents,
            currency: "usd",
          },
          createdAt: timestamp,
        });

        return {
          task: taskFromRow(updatedTask),
          payment: paymentFromRow(paymentRow),
          replayed: false,
        };
      });
    },
  };
}

function assertPaymentPermission(actor: OpsAccess): void {
  if (!actor.permissions.includes("task.write")) throw new HumanTaskTransitionForbiddenError();
}

function assertRetentionDays(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > 3_650) {
    throw new Error("Human Task payment retention days must be a whole number between 1 and 3650.");
  }
  return value;
}

function centsToUsd(value: number): string {
  return (value / 100).toFixed(2);
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

function paymentFromRow(row: typeof humanTaskPayments.$inferSelect): HumanTaskPayment {
  return HumanTaskPaymentSchema.parse({
    id: row.id,
    task_id: row.taskId,
    provider: row.provider,
    provider_checkout_session_id: row.providerCheckoutSessionId,
    provider_payment_intent_id: row.providerPaymentIntentId,
    provider_event_id: row.providerEventId,
    amount_cents: row.amountCents,
    currency: row.currency,
    checkout_url: row.checkoutUrl,
    status: row.status,
    paid_at: row.paidAt?.toISOString() ?? null,
    retention_expires_at: row.retentionExpiresAt.toISOString(),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  });
}
