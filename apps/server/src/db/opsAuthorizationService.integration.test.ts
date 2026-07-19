import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbOpsAuthorizationService } from "./opsAuthorizationService.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const adminId = "30000000-0000-4000-8000-000000000001";
const operatorId = "30000000-0000-4000-8000-000000000002";

describeDatabase("database OpsAuthorizationService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbOpsAuthorizationService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`delete from public.ops_audit_events where actor_id in (${adminId}, ${operatorId})`;
    await sql`delete from public.ops_memberships where user_id in (${adminId}, ${operatorId})`;
    await sql`delete from auth.users where id in (${adminId}, ${operatorId})`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values
        (${adminId}, 'authenticated', 'authenticated', 'admin-test@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
        (${operatorId}, 'authenticated', 'authenticated', 'operator-test@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now())
    `;
    await sql`
      insert into public.ops_memberships (user_id, role)
      values (${adminId}, 'admin')
    `;
  });

  afterAll(async () => {
    await sql`delete from public.ops_audit_events where actor_id in (${adminId}, ${operatorId})`;
    await sql`delete from public.ops_memberships where user_id in (${adminId}, ${operatorId})`;
    await sql`delete from auth.users where id in (${adminId}, ${operatorId})`;
    await sql.end();
  });

  it("resolves explicit permissions, writes membership, and appends audit evidence", async () => {
    const admin = await service.getAccess(adminId);
    expect(admin).toMatchObject({
      role: "admin",
      permissions: ["membership.read", "membership.write", "partner.read", "partner.write"],
    });

    await expect(service.setMembership(admin!, operatorId, "operator")).resolves.toMatchObject({
      userId: operatorId,
      role: "operator",
      createdBy: adminId,
    });
    await expect(service.getAccess(operatorId)).resolves.toMatchObject({
      role: "operator",
      permissions: ["task.read", "task.contact.read", "task.write"],
    });
    await expect(service.listAudit(admin!)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          actorId: adminId,
          action: "membership.set",
          targetId: operatorId,
        }),
      ]),
    );
  });
});
