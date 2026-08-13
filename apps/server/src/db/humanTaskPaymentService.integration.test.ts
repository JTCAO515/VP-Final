import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "./schema.js";
import {
  createDbHumanTaskPaymentCheckoutService,
  HumanTaskPaymentStateError,
} from "./humanTaskPaymentService.js";
import { HumanTaskTransitionForbiddenError } from "../modules/task/service.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const taskId = "73000000-0000-4000-8000-000000000001";
const operatorId = "73000000-0000-4000-8000-000000000002";
const actor = {
  userId: operatorId,
  role: "operator" as const,
  permissions: ["task.read", "task.contact.read", "task.write"] as const,
};

describeDatabase("database HumanTask payment Checkout writer", () => {
  const sql = postgres(databaseUrl!);
  const db = drizzle(sql, { schema });

  beforeEach(async () => {
    await sql`delete from public.ops_audit_events where actor_id = ${operatorId}`;
    await sql`delete from public.human_tasks where id = ${taskId}`;
    await sql`delete from auth.users where id = ${operatorId}`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        ${operatorId}, 'authenticated', 'authenticated', 'payment-operator@example.com', '',
        '{}'::jsonb, '{}'::jsonb, now(), now()
      )
    `;
  });

  afterAll(async () => {
    await sql`delete from public.ops_audit_events where actor_id = ${operatorId}`;
    await sql`delete from public.human_tasks where id = ${taskId}`;
    await sql`delete from auth.users where id = ${operatorId}`;
    await sql.end();
  });

  it("creates one private ledger row and atomically moves a quoted task to payment_pending", async () => {
    await insertQuotedTask(sql);
    const createSession = vi.fn(async () => ({
      id: "cs_test_human_task_001",
      url: "https://checkout.stripe.com/c/pay/cs_test_human_task_001",
    }));
    const service = createDbHumanTaskPaymentCheckoutService(db, {
      gateway: { createSession },
      retentionDays: 400,
      now: () => new Date("2099-01-10T00:00:00.000Z"),
    });

    const created = await service.createCheckout({
      taskId,
      amountCents: 1499,
      actor: { ...actor, permissions: [...actor.permissions] },
    });
    const replay = await service.createCheckout({
      taskId,
      amountCents: 1499,
      actor: { ...actor, permissions: [...actor.permissions] },
    });

    expect(created.replayed).toBe(false);
    expect(created.task).toMatchObject({
      status: "payment_pending",
      price_usd: 14.99,
      payment_link: "https://checkout.stripe.com/c/pay/cs_test_human_task_001",
    });
    expect(created.payment).toMatchObject({
      task_id: taskId,
      provider: "stripe",
      provider_checkout_session_id: "cs_test_human_task_001",
      amount_cents: 1499,
      currency: "usd",
      status: "checkout_open",
    });
    expect(replay).toMatchObject({ replayed: true, payment: { id: created.payment.id } });
    expect(createSession).toHaveBeenCalledTimes(1);

    const [transition] = await sql`
      select from_status, to_status, reason from public.human_task_transitions where task_id = ${taskId}
    `;
    expect(transition).toMatchObject({ from_status: "quoted", to_status: "payment_pending" });
    const [audit] = await sql`
      select metadata_jsonb from public.ops_audit_events
      where target_id = ${created.payment.id} and action = 'human_task.payment.checkout_created'
    `;
    expect(audit?.metadata_jsonb).toEqual({
      taskId,
      provider: "stripe",
      amountCents: 1499,
      currency: "usd",
    });
    expect(JSON.stringify(audit)).not.toContain("checkout.stripe.com");
    expect(JSON.stringify(audit)).not.toContain("cs_test_human_task_001");
  });

  it("fails closed for an unquoted task before it contacts Stripe or writes a ledger row", async () => {
    await insertQuotedTask(sql, "triaged");
    const createSession = vi.fn(async () => ({
      id: "cs_test_human_task_002",
      url: "https://checkout.stripe.com/c/pay/cs_test_human_task_002",
    }));
    const service = createDbHumanTaskPaymentCheckoutService(db, {
      gateway: { createSession },
      retentionDays: 400,
    });

    await expect(
      service.createCheckout({
        taskId,
        amountCents: 1499,
        actor: { ...actor, permissions: [...actor.permissions] },
      }),
    ).rejects.toBeInstanceOf(HumanTaskPaymentStateError);
    expect(createSession).not.toHaveBeenCalled();
    const [paymentCount] = await sql`
      select count(*)::int as value from public.human_task_payments where task_id = ${taskId}
    `;
    expect(paymentCount?.value).toBe(0);
  });

  it("requires the existing Ops task-write permission before it contacts Stripe", async () => {
    await insertQuotedTask(sql);
    const createSession = vi.fn(async () => ({
      id: "cs_test_human_task_003",
      url: "https://checkout.stripe.com/c/pay/cs_test_human_task_003",
    }));
    const service = createDbHumanTaskPaymentCheckoutService(db, {
      gateway: { createSession },
      retentionDays: 400,
    });

    await expect(
      service.createCheckout({
        taskId,
        amountCents: 1499,
        actor: { userId: operatorId, role: "editor", permissions: ["knowledge.read"] },
      }),
    ).rejects.toBeInstanceOf(HumanTaskTransitionForbiddenError);
    expect(createSession).not.toHaveBeenCalled();
  });
});

async function insertQuotedTask(
  sql: postgres.Sql<Record<string, never>>,
  status: "quoted" | "triaged" = "quoted",
) {
  await sql`
    insert into public.human_tasks (
      id, anon_id, idempotency_key, city, kind, description, contact, status, created_at, updated_at
    ) values (
      ${taskId}, ${"p".repeat(43)}, ${crypto.randomUUID()}, 'Shanghai', 'ticket_help',
      'Please confirm a ticket request for the upcoming visit.', 'traveler@example.com', ${status}, now(), now()
    )
  `;
}
