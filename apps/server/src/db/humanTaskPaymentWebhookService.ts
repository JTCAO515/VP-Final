import {
  HumanTaskPaymentSchema,
  HumanTaskSchema,
  transitionHumanTask,
  type HumanTask,
  type HumanTaskPayment,
} from "@visepanda/domain";
import { and, desc, eq, sql } from "drizzle-orm";
import type { Db } from "./client.js";
import { humanTaskPayments, humanTaskTransitions, humanTasks, opsAuditEvents } from "./schema.js";
import type { VerifiedStripeCheckoutCompletedEvent } from "../modules/task/stripeWebhook.js";
import { HumanTaskNotFoundError } from "../modules/task/service.js";

export type HumanTaskPaymentWebhookResult = {
  task: HumanTask;
  payment: HumanTaskPayment;
  replayed: boolean;
};

export type HumanTaskPaymentWebhookService = {
  consumeVerifiedCheckout(
    event: VerifiedStripeCheckoutCompletedEvent,
  ): Promise<HumanTaskPaymentWebhookResult>;
};

export class HumanTaskPaymentWebhookMismatchError extends Error {
  readonly code = "HUMAN_TASK_PAYMENT_WEBHOOK_MISMATCH";

  constructor() {
    super("The verified payment event does not match an open Human Task checkout.");
    this.name = "HumanTaskPaymentWebhookMismatchError";
  }
}

export class HumanTaskPaymentWebhookStateError extends Error {
  readonly code = "HUMAN_TASK_PAYMENT_WEBHOOK_STATE_INVALID";

  constructor() {
    super("The matching Human Task payment cannot be updated from its current state.");
    this.name = "HumanTaskPaymentWebhookStateError";
  }
}

type LedgerPayment = Pick<
  HumanTaskPayment,
  | "provider"
  | "provider_checkout_session_id"
  | "provider_payment_intent_id"
  | "provider_event_id"
  | "amount_cents"
  | "currency"
  | "status"
>;

/**
 * A signed provider event still has to agree with the durable, private ledger. A second delivery
 * may replay only the exact provider event that previously moved the same ledger row to paid.
 */
export function resolveVerifiedPaymentDisposition(
  payment: LedgerPayment,
  event: VerifiedStripeCheckoutCompletedEvent,
): "apply" | "replay" {
  if (
    payment.provider !== "stripe" ||
    payment.provider_checkout_session_id !== event.providerCheckoutSessionId ||
    payment.amount_cents !== event.amountCents ||
    payment.currency !== event.currency
  ) {
    throw new HumanTaskPaymentWebhookMismatchError();
  }

  if (payment.status === "paid") {
    if (
      payment.provider_event_id === event.providerEventId &&
      payment.provider_payment_intent_id === event.providerPaymentIntentId
    ) {
      return "replay";
    }
    throw new HumanTaskPaymentWebhookMismatchError();
  }

  if (
    payment.status !== "checkout_open" ||
    payment.provider_event_id !== null ||
    payment.provider_payment_intent_id !== null
  ) {
    throw new HumanTaskPaymentWebhookStateError();
  }
  return "apply";
}

/**
 * Consumes an already signature-verified, minimized Stripe event. This boundary never receives a
 * raw payload, a Stripe signature, a secret, or card details. It records a provider completion only
 * when the private ledger and matching task are still in their expected pre-payment states.
 */
export function createDbHumanTaskPaymentWebhookService(
  db: Db,
  options?: { now?: () => Date },
): HumanTaskPaymentWebhookService {
  const now = options?.now ?? (() => new Date());

  return {
    async consumeVerifiedCheckout(event) {
      return db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtextextended(${`human-task-payment:${event.taskId}`}, 0))`,
        );
        const [paymentRow] = await tx
          .select()
          .from(humanTaskPayments)
          .where(
            and(
              eq(humanTaskPayments.provider, "stripe"),
              eq(humanTaskPayments.providerCheckoutSessionId, event.providerCheckoutSessionId),
            ),
          )
          .for("update")
          .limit(1);
        if (!paymentRow || paymentRow.taskId !== event.taskId) {
          throw new HumanTaskPaymentWebhookMismatchError();
        }
        const [eventPayment] = await tx
          .select({ id: humanTaskPayments.id })
          .from(humanTaskPayments)
          .where(
            and(
              eq(humanTaskPayments.provider, "stripe"),
              eq(humanTaskPayments.providerEventId, event.providerEventId),
            ),
          )
          .for("update")
          .limit(1);
        if (eventPayment && eventPayment.id !== paymentRow.id) {
          throw new HumanTaskPaymentWebhookMismatchError();
        }

        const [taskRow] = await tx
          .select()
          .from(humanTasks)
          .where(eq(humanTasks.id, event.taskId))
          .for("update")
          .limit(1);
        if (!taskRow) throw new HumanTaskNotFoundError();

        const disposition = resolveVerifiedPaymentDisposition(paymentFromRow(paymentRow), event);
        if (disposition === "replay") {
          if (taskRow.status !== "paid") throw new HumanTaskPaymentWebhookStateError();
          return {
            task: taskFromRow(taskRow),
            payment: paymentFromRow(paymentRow),
            replayed: true,
          };
        }
        if (taskRow.status !== "payment_pending") throw new HumanTaskPaymentWebhookStateError();

        const [checkoutAudit] = await tx
          .select({ actorId: opsAuditEvents.actorId })
          .from(opsAuditEvents)
          .where(
            and(
              eq(opsAuditEvents.action, "human_task.payment.checkout_created"),
              eq(opsAuditEvents.targetType, "human_task_payment"),
              eq(opsAuditEvents.targetId, paymentRow.id),
            ),
          )
          .orderBy(desc(opsAuditEvents.createdAt))
          .limit(1);
        if (!checkoutAudit) throw new HumanTaskPaymentWebhookStateError();

        const timestamp = now();
        // Keep the external-evidence writer bound to the same domain transition graph as Ops.
        transitionHumanTask(taskFromRow(taskRow), "paid", timestamp);
        const [updatedPayment] = await tx
          .update(humanTaskPayments)
          .set({
            providerPaymentIntentId: event.providerPaymentIntentId,
            providerEventId: event.providerEventId,
            status: "paid",
            paidAt: timestamp,
            updatedAt: timestamp,
          })
          .where(
            and(
              eq(humanTaskPayments.id, paymentRow.id),
              eq(humanTaskPayments.status, "checkout_open"),
            ),
          )
          .returning();
        if (!updatedPayment) throw new HumanTaskPaymentWebhookStateError();

        const [updatedTask] = await tx
          .update(humanTasks)
          .set({ status: "paid", updatedAt: timestamp })
          .where(and(eq(humanTasks.id, event.taskId), eq(humanTasks.status, "payment_pending")))
          .returning();
        if (!updatedTask) throw new HumanTaskPaymentWebhookStateError();

        await tx.insert(humanTaskTransitions).values({
          id: crypto.randomUUID(),
          taskId: event.taskId,
          fromStatus: "payment_pending",
          toStatus: "paid",
          actorId: checkoutAudit.actorId,
          reason: "Verified Stripe checkout completion synchronized the payment ledger.",
          createdAt: timestamp,
        });
        await tx.insert(opsAuditEvents).values({
          actorId: checkoutAudit.actorId,
          action: "human_task.payment.webhook_paid",
          targetType: "human_task_payment",
          targetId: paymentRow.id,
          metadataJsonb: {
            taskId: event.taskId,
            provider: "stripe",
            eventType: "checkout.session.completed",
          },
          createdAt: timestamp,
        });

        return {
          task: taskFromRow(updatedTask),
          payment: paymentFromRow(updatedPayment),
          replayed: false,
        };
      });
    },
  };
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
