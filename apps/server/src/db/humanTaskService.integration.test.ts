import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbHumanTaskService } from "./humanTaskService.js";
import { HumanTaskCapacityError } from "../modules/task/service.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const anonA = "a".repeat(43);
const anonB = "b".repeat(43);
const anonCapacity = "c".repeat(43);
const userId = "71000000-0000-4000-8000-000000000001";
const operatorId = "71000000-0000-4000-8000-000000000002";
const request = {
  city: "Shanghai",
  kind: "call_restaurant" as const,
  description: "Please call this restaurant to confirm ordinary availability.",
  contact: "traveler@example.com",
};

describeDatabase("database HumanTaskService", () => {
  const sql = postgres(databaseUrl!);
  const db = drizzle(sql, { schema });

  beforeEach(async () => {
    await sql`delete from public.ops_audit_events where actor_id = ${operatorId} and action = 'human_task.note.updated'`;
    await sql`delete from public.human_tasks where anon_id in (${anonA}, ${anonB}, ${anonCapacity}) or user_id = ${userId}`;
    await sql`delete from public.users where id = ${userId}`;
    await sql`delete from auth.users where id = ${userId}`;
    await sql`delete from auth.users where id = ${operatorId}`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        ${operatorId}, 'authenticated', 'authenticated', 'operator@example.com', '',
        '{}'::jsonb, '{}'::jsonb, now(), now()
      )
    `;
  });

  afterAll(async () => {
    await sql`delete from public.ops_audit_events where actor_id = ${operatorId} and action = 'human_task.note.updated'`;
    await sql`delete from public.human_tasks where anon_id in (${anonA}, ${anonB}, ${anonCapacity}) or user_id = ${userId}`;
    await sql`delete from public.users where id = ${userId}`;
    await sql`delete from auth.users where id = ${userId}`;
    await sql`delete from auth.users where id = ${operatorId}`;
    await sql.end();
  });

  it("persists one anonymous request across adapter re-instantiation and scopes traveler reads", async () => {
    const now = () => new Date("2099-01-01T04:00:00.000Z");
    const first = createDbHumanTaskService(db, { now });
    const command = {
      identity: { kind: "anonymous" as const, anonId: anonA },
      idempotencyKey: crypto.randomUUID(),
      request,
    };
    const created = await first.create(command);

    const second = createDbHumanTaskService(db, { now });
    await expect(second.create(command)).resolves.toEqual(created);
    await expect(
      second.create({
        ...command,
        request: { ...request, contact: "different@example.com" },
      }),
    ).rejects.toMatchObject({ name: "HumanTaskIdempotencyConflictError" });
    await expect(second.listForOwner(command.identity)).resolves.toEqual([created]);
    await expect(second.listForOwner({ kind: "anonymous", anonId: anonB })).resolves.toEqual([]);
    await expect(second.listForOps()).resolves.toContainEqual(created);
  });

  it("persists authenticated ownership without accepting a caller-supplied owner field", async () => {
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        ${userId}, 'authenticated', 'authenticated', 'verified@example.com', '',
        '{}'::jsonb, '{}'::jsonb, now(), now()
      )
    `;
    const service = createDbHumanTaskService(db, {
      now: () => new Date("2099-01-03T04:00:00.000Z"),
    });
    const identity = {
      kind: "authenticated" as const,
      userId,
      email: "verified@example.com",
    };
    const created = await service.create({
      identity,
      idempotencyKey: crypto.randomUUID(),
      request,
    });

    await expect(service.listForOwner(identity)).resolves.toEqual([created]);
    const [row] =
      await sql`select user_id, anon_id from public.human_tasks where id = ${created.id}`;
    expect(row).toMatchObject({ user_id: userId, anon_id: null });

    await sql`delete from public.users where id = ${userId}`;
    await expect(service.listForOwner(identity)).resolves.toEqual([]);
  });

  it("serializes and enforces the five-request China-day capacity", async () => {
    const service = createDbHumanTaskService(db, {
      now: () => new Date("2099-01-02T04:00:00.000Z"),
    });
    const identity = { kind: "anonymous" as const, anonId: anonCapacity };

    for (let index = 0; index < 5; index += 1) {
      await service.create({ identity, idempotencyKey: crypto.randomUUID(), request });
    }

    await expect(
      service.create({ identity, idempotencyKey: crypto.randomUUID(), request }),
    ).rejects.toBeInstanceOf(HumanTaskCapacityError);
  });

  it("updates status and appends actor/reason audit evidence atomically", async () => {
    const service = createDbHumanTaskService(db);
    const created = await service.create({
      identity: { kind: "anonymous", anonId: anonA },
      idempotencyKey: crypto.randomUUID(),
      request,
    });
    const actor = {
      userId: operatorId,
      role: "operator" as const,
      permissions: ["task.read", "task.contact.read", "task.write"] as const,
    };

    const result = await service.transition({
      taskId: created.id,
      actor: { ...actor, permissions: [...actor.permissions] },
      toStatus: "triaged",
      reason: "Scope, safety, capacity, and required information were reviewed.",
    });

    expect(result.task.status).toBe("triaged");
    expect(new Date(result.task.updated_at).getTime()).toBeGreaterThanOrEqual(
      new Date(created.created_at).getTime(),
    );
    await expect(
      service.listTransitions(created.id, { ...actor, permissions: [...actor.permissions] }),
    ).resolves.toEqual([result.transition]);
    const [audit] = await sql`
      select actor_id, from_status, to_status, reason
      from public.human_task_transitions where task_id = ${created.id}
    `;
    expect(audit).toMatchObject({
      actor_id: operatorId,
      from_status: "requested",
      to_status: "triaged",
      reason: "Scope, safety, capacity, and required information were reviewed.",
    });
  });

  it("persists an internal operator note and protects detail reads", async () => {
    const service = createDbHumanTaskService(db, {
      now: () => new Date("2099-01-04T04:00:00.000Z"),
    });
    const created = await service.create({
      identity: { kind: "anonymous", anonId: anonA },
      idempotencyKey: crypto.randomUUID(),
      request,
    });
    const operator = {
      userId: operatorId,
      role: "operator" as const,
      permissions: ["task.read", "task.contact.read", "task.write"] as const,
    };

    await expect(
      service.getForOps(created.id, {
        userId: operatorId,
        role: "editor",
        permissions: ["knowledge.read", "knowledge.write"],
      }),
    ).rejects.toMatchObject({ code: "HUMAN_TASK_TRANSITION_FORBIDDEN" });

    const updated = await service.updateOperatorNote({
      taskId: created.id,
      actor: { ...operator, permissions: [...operator.permissions] },
      note: "Scope confirmed; waiting for the traveler to confirm the restaurant name.",
    });
    expect(updated.operator_note).toBe(
      "Scope confirmed; waiting for the traveler to confirm the restaurant name.",
    );

    const fresh = createDbHumanTaskService(db);
    await expect(
      fresh.getForOps(created.id, { ...operator, permissions: [...operator.permissions] }),
    ).resolves.toMatchObject({ operator_note: updated.operator_note });
    const [audit] = await sql`
      select action, target_type, target_id, metadata_jsonb
      from public.ops_audit_events
      where target_id = ${created.id}
    `;
    expect(audit).toMatchObject({
      action: "human_task.note.updated",
      target_type: "human_task",
      target_id: created.id,
      metadata_jsonb: { notePresent: true },
    });
    expect(JSON.stringify(audit)).not.toContain(updated.operator_note);
    expect(JSON.stringify(audit)).not.toContain(request.contact);
  });

  it("leaves status and audit unchanged when policy or transition validation rejects", async () => {
    const service = createDbHumanTaskService(db, {
      now: () => new Date("2099-01-05T04:00:00.000Z"),
    });
    const created = await service.create({
      identity: { kind: "anonymous", anonId: anonB },
      idempotencyKey: crypto.randomUUID(),
      request,
    });
    const actor = {
      userId: operatorId,
      role: "operator" as const,
      permissions: ["task.read", "task.contact.read", "task.write"] as const,
    };

    await expect(
      service.transition({
        taskId: created.id,
        actor: { ...actor, permissions: [...actor.permissions] },
        toStatus: "done",
        reason: "Attempted to skip all required lifecycle and payment states.",
      }),
    ).rejects.toMatchObject({ code: "INVALID_HUMAN_TASK_TRANSITION" });
    const [row] = await sql`select status from public.human_tasks where id = ${created.id}`;
    const [count] = await sql`
      select count(*)::int as value from public.human_task_transitions where task_id = ${created.id}
    `;
    expect(row?.status).toBe("requested");
    expect(count?.value).toBe(0);
  });
});
