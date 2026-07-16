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
    await sql`delete from public.human_tasks where anon_id in (${anonA}, ${anonB}, ${anonCapacity}) or user_id = ${userId}`;
    await sql`delete from public.users where id = ${userId}`;
    await sql`delete from auth.users where id = ${userId}`;
  });

  afterAll(async () => {
    await sql`delete from public.human_tasks where anon_id in (${anonA}, ${anonB}, ${anonCapacity}) or user_id = ${userId}`;
    await sql`delete from public.users where id = ${userId}`;
    await sql`delete from auth.users where id = ${userId}`;
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
});
