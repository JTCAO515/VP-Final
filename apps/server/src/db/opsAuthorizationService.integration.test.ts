import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbOpsAuthorizationService } from "./opsAuthorizationService.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const adminId = "30000000-0000-4000-8000-000000000001";
const operatorId = "30000000-0000-4000-8000-000000000002";
const secondAdminId = "30000000-0000-4000-8000-000000000003";

describeDatabase("database OpsAuthorizationService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbOpsAuthorizationService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`drop trigger if exists issue451_fail_audit on public.ops_audit_events`;
    await sql`drop function if exists public.issue451_fail_audit()`;
    await sql`delete from public.ops_audit_events where actor_id in (${adminId}, ${operatorId}, ${secondAdminId})`;
    await sql`delete from public.ops_memberships where user_id in (${adminId}, ${operatorId}, ${secondAdminId})`;
    await sql`delete from auth.users where id in (${adminId}, ${operatorId}, ${secondAdminId})`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values
        (${adminId}, 'authenticated', 'authenticated', 'admin-test@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
        (${operatorId}, 'authenticated', 'authenticated', 'operator-test@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
        (${secondAdminId}, 'authenticated', 'authenticated', 'second-admin-test@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now())
    `;
    await sql`
      insert into public.ops_memberships (user_id, role)
      values (${adminId}, 'admin')
    `;
  });

  afterAll(async () => {
    await sql`drop trigger if exists issue451_fail_audit on public.ops_audit_events`;
    await sql`drop function if exists public.issue451_fail_audit()`;
    await sql`delete from public.ops_audit_events where actor_id in (${adminId}, ${operatorId}, ${secondAdminId})`;
    await sql`delete from public.ops_memberships where user_id in (${adminId}, ${operatorId}, ${secondAdminId})`;
    await sql`delete from auth.users where id in (${adminId}, ${operatorId}, ${secondAdminId})`;
    await sql.end();
  });

  it("resolves explicit permissions, writes membership, and appends audit evidence", async () => {
    const admin = await service.getAccess(adminId);
    expect(admin).toMatchObject({
      role: "admin",
      permissions: [
        "membership.read",
        "membership.write",
        "partner.read",
        "partner.write",
        "cost.read",
        "visepod.provision",
      ],
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

  it("assigns only a registered exact email and revokes the member for the next online access check", async () => {
    const admin = (await service.getAccess(adminId))!;

    await expect(
      service.setMembershipByExactEmail(admin, "OPERATOR-TEST@example.com", "operator"),
    ).resolves.toMatchObject({ userId: operatorId, role: "operator", revokedAt: null });
    await expect(
      service.setMembershipByExactEmail(admin, "missing@example.com", "editor"),
    ).resolves.toBeNull();

    await expect(service.revokeMembership(admin, operatorId)).resolves.toMatchObject({
      userId: operatorId,
      revokedBy: adminId,
    });
    await expect(service.getAccess(operatorId)).resolves.toBeNull();
    await expect(service.listAudit(admin)).resolves.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "membership.set", targetId: operatorId }),
        expect.objectContaining({ action: "membership.revoked", targetId: operatorId }),
      ]),
    );
  });

  it("serializes concurrent admin removals so one active admin remains", async () => {
    await sql`insert into public.ops_memberships (user_id, role) values (${secondAdminId}, 'admin')`;
    const firstAdmin = (await service.getAccess(adminId))!;
    const secondAdmin = (await service.getAccess(secondAdminId))!;

    const results = await Promise.allSettled([
      service.revokeMembership(firstAdmin, secondAdminId),
      service.revokeMembership(secondAdmin, adminId),
    ]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(
      [await service.getAccess(adminId), await service.getAccess(secondAdminId)].filter(Boolean),
    ).toHaveLength(1);
  });

  it("rolls back a membership mutation when its audit insert fails", async () => {
    const admin = (await service.getAccess(adminId))!;
    await sql`
      create function public.issue451_fail_audit()
      returns trigger language plpgsql as $$ begin raise exception 'audit unavailable'; end $$
    `;
    await sql`
      create trigger issue451_fail_audit before insert on public.ops_audit_events
      for each row execute function public.issue451_fail_audit()
    `;

    await expect(service.setMembership(admin, operatorId, "operator")).rejects.toThrow(
      "audit unavailable",
    );
    await expect(service.getAccess(operatorId)).resolves.toBeNull();

    await sql`drop trigger issue451_fail_audit on public.ops_audit_events`;
    await service.setMembership(admin, operatorId, "operator");
    await sql`
      create trigger issue451_fail_audit before insert on public.ops_audit_events
      for each row execute function public.issue451_fail_audit()
    `;
    await expect(service.revokeMembership(admin, operatorId)).rejects.toThrow("audit unavailable");
    await expect(service.getAccess(operatorId)).resolves.toMatchObject({ role: "operator" });
  });
});
