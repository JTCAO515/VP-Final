import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbVisePodBindingService } from "./visePodBindingService.js";
import { createInMemoryOpsAuthorizationService } from "../modules/opsAuthorization/service.js";
import { createInMemoryVisePodProvisioningService } from "../modules/visepod/provisioning.js";
import {
  createVisePodKnownDeviceCatalog,
  VisePodBindingDeviceNotFoundError,
  VisePodBindingIdempotencyConflictError,
  VisePodBindingStateConflictError,
  VisePodBindingUserNotFoundError,
} from "../modules/visepod/binding.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const adminId = "33900000-0000-4000-8000-000000000001";
const travelerOneId = "33900000-0000-4000-8000-000000000002";
const travelerTwoId = "33900000-0000-4000-8000-000000000003";
const deviceId = "issue339-device-001";
const baseAt = new Date("2026-08-13T00:00:00.000Z");

describeDatabase("database VisePodBindingService", () => {
  const sql = postgres(databaseUrl!);
  const authorization = createInMemoryOpsAuthorizationService([{ userId: adminId, role: "admin" }]);
  const provisioning = createInMemoryVisePodProvisioningService(authorization, () => baseAt);
  const catalog = createVisePodKnownDeviceCatalog([deviceId]);
  const service = createDbVisePodBindingService(
    drizzle(sql, { schema }),
    provisioning,
    catalog,
    () => baseAt,
  );

  beforeEach(async () => {
    await sql`delete from public.ops_audit_events where target_id = ${deviceId}`;
    await sql`delete from public.visepod_device_bindings where device_id = ${deviceId}`;
    await sql`delete from public.users where id in (${travelerOneId}, ${travelerTwoId})`;
    await sql`delete from auth.users where id in (${adminId}, ${travelerOneId}, ${travelerTwoId})`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values
        (${adminId}, 'authenticated', 'authenticated', 'issue339-admin@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
        (${travelerOneId}, 'authenticated', 'authenticated', 'issue339-first@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
        (${travelerTwoId}, 'authenticated', 'authenticated', 'issue339-second@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now())
    `;
    await sql`
      insert into public.users (id, email)
      values
        (${travelerOneId}, 'issue339-first@example.test'),
        (${travelerTwoId}, 'issue339-second@example.test')
    `;
  });

  afterAll(async () => {
    await sql`delete from public.ops_audit_events where target_id = ${deviceId}`;
    await sql`delete from public.visepod_device_bindings where device_id = ${deviceId}`;
    await sql`delete from public.users where id in (${travelerOneId}, ${travelerTwoId})`;
    await sql`delete from auth.users where id in (${adminId}, ${travelerOneId}, ${travelerTwoId})`;
    await sql.end();
  });

  async function token() {
    const admin = (await authorization.getAccess(adminId))!;
    return (await provisioning.issue(admin, "development")).token;
  }

  function bindCommand(userId: string, idempotencyKey: string) {
    return {
      operation: "bind" as const,
      deviceId,
      userId,
      idempotencyKey,
      reason: "Assign the controlled demonstration device to the selected traveler.",
    };
  }

  it("reads an unbound known device, creates it once, and replays without a second audit", async () => {
    const issued = await token();
    await expect(
      service.get({ token: issued, environment: "development", deviceId }),
    ).resolves.toBeNull();
    const command = bindCommand(travelerOneId, "33900000-0000-4000-8000-000000000010");
    const created = await service.mutate({ token: issued, environment: "development", command });
    expect(created).toMatchObject({
      outcome: "created",
      idempotencyHit: false,
      binding: { userId: travelerOneId },
    });
    await expect(
      service.mutate({ token: issued, environment: "development", command }),
    ).resolves.toMatchObject({
      outcome: "created",
      idempotencyHit: true,
      binding: { userId: travelerOneId },
    });
    const audits =
      await sql`select action, metadata_jsonb from public.ops_audit_events where target_id = ${deviceId}`;
    expect(audits).toEqual([
      expect.objectContaining({
        action: "visepod.binding.created",
        metadata_jsonb: {
          deviceId,
          previousUserId: null,
          nextUserId: travelerOneId,
          result: "succeeded",
        },
      }),
    ]);
    expect(JSON.stringify(audits)).not.toContain("controlled demonstration");
    expect(JSON.stringify(audits)).not.toContain("wifi");
  });

  it("rebinds by preserving a revoked history row, then revokes the active assignment", async () => {
    const issued = await token();
    await service.mutate({
      token: issued,
      environment: "development",
      command: bindCommand(travelerOneId, "33900000-0000-4000-8000-000000000011"),
    });
    await expect(
      service.mutate({
        token: issued,
        environment: "development",
        command: bindCommand(travelerTwoId, "33900000-0000-4000-8000-000000000012"),
      }),
    ).resolves.toMatchObject({ outcome: "rebound", binding: { userId: travelerTwoId } });
    await expect(
      service.mutate({
        token: issued,
        environment: "development",
        command: {
          operation: "unbind",
          deviceId,
          idempotencyKey: "33900000-0000-4000-8000-000000000013",
          reason: "Remove the device from the completed controlled demonstration.",
        },
      }),
    ).resolves.toMatchObject({ outcome: "revoked", binding: null });
    await expect(
      service.get({ token: issued, environment: "development", deviceId }),
    ).resolves.toBeNull();
    const history =
      await sql`select state, user_id from public.visepod_device_bindings where device_id = ${deviceId} order by created_at, id`;
    expect(history).toEqual([
      { state: "revoked", user_id: travelerOneId },
      { state: "revoked", user_id: travelerTwoId },
    ]);
  });

  it("rejects unknown devices, absent users, changed idempotency keys, and invalid state without mutation", async () => {
    const issued = await token();
    await expect(
      service.get({ token: issued, environment: "development", deviceId: "unknown-device" }),
    ).rejects.toBeInstanceOf(VisePodBindingDeviceNotFoundError);
    await expect(
      service.mutate({
        token: issued,
        environment: "development",
        command: bindCommand(
          "33900000-0000-4000-8000-000000000099",
          "33900000-0000-4000-8000-000000000014",
        ),
      }),
    ).rejects.toBeInstanceOf(VisePodBindingUserNotFoundError);
    const key = "33900000-0000-4000-8000-000000000015";
    await service.mutate({
      token: issued,
      environment: "development",
      command: bindCommand(travelerOneId, key),
    });
    await expect(
      service.mutate({
        token: issued,
        environment: "development",
        command: bindCommand(travelerTwoId, key),
      }),
    ).rejects.toBeInstanceOf(VisePodBindingIdempotencyConflictError);
    await expect(
      service.mutate({
        token: issued,
        environment: "development",
        command: bindCommand(travelerOneId, "33900000-0000-4000-8000-000000000016"),
      }),
    ).rejects.toBeInstanceOf(VisePodBindingStateConflictError);
  });

  it("rolls back the binding and idempotency receipt when audit persistence fails", async () => {
    const issued = await token();
    const failingService = createDbVisePodBindingService(
      drizzle(sql, { schema }),
      provisioning,
      catalog,
      () => baseAt,
      {
        beforeAudit: () => {
          throw new Error("injected audit failure");
        },
      },
    );
    await expect(
      failingService.mutate({
        token: issued,
        environment: "development",
        command: bindCommand(travelerOneId, "33900000-0000-4000-8000-000000000017"),
      }),
    ).rejects.toThrow("injected audit failure");
    const bindings =
      await sql`select count(*)::int as count from public.visepod_device_bindings where device_id = ${deviceId}`;
    const receipts = await sql`
      select count(*)::int as count from public.visepod_binding_idempotency where idempotency_key = '33900000-0000-4000-8000-000000000017'::uuid
    `;
    const audits =
      await sql`select count(*)::int as count from public.ops_audit_events where target_id = ${deviceId}`;
    expect(bindings[0]?.count).toBe(0);
    expect(receipts[0]?.count).toBe(0);
    expect(audits[0]?.count).toBe(0);
  });
});
