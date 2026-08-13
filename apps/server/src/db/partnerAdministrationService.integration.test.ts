import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import {
  PartnerActivationConfirmationError,
  PartnerAdministrationForbiddenError,
  PartnerConfigurationConflictError,
} from "../modules/commerce/partnerAdministration.js";
import { createDbPartnerAdministrationService } from "./partnerAdministrationService.js";
import type { OpsAccess } from "../modules/opsAuthorization/service.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const adminId = "41000000-0000-4000-8000-000000000001";
const editorId = "41000000-0000-4000-8000-000000000002";
const partnerKeyOne = "issue316_one";
const partnerKeyTwo = "issue316_two";

const admin: OpsAccess = {
  userId: adminId,
  role: "admin" as const,
  permissions: ["partner.read", "partner.write"],
};
const editor: OpsAccess = {
  userId: editorId,
  role: "editor" as const,
  permissions: ["knowledge.read", "knowledge.write"],
};
const configuration = {
  key: partnerKeyOne,
  hosts: ["issue316.example.com"],
  categories: ["hotel"],
  cities: ["Shanghai"],
  trackingParam: "vp_click_id",
};

describeDatabase("database PartnerAdministrationService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbPartnerAdministrationService(drizzle(sql, { schema }), {
    now: () => new Date("2026-07-26T12:00:00.000Z"),
  });

  beforeEach(async () => {
    await sql`drop trigger if exists issue316_fail_audit on public.ops_audit_events`;
    await sql`drop function if exists public.issue316_fail_partner_audit()`;
    await sql`delete from public.ops_audit_events where target_id in (${partnerKeyOne}, ${partnerKeyTwo})`;
    await sql`delete from public.outbound_clicks where partner in (${partnerKeyOne}, ${partnerKeyTwo})`;
    await sql`delete from public.partners where key in (${partnerKeyOne}, ${partnerKeyTwo})`;
    await sql`delete from public.ops_memberships where user_id in (${adminId}, ${editorId})`;
    await sql`delete from auth.users where id in (${adminId}, ${editorId})`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values
        (${adminId}, 'authenticated', 'authenticated', 'issue316-db-admin@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
        (${editorId}, 'authenticated', 'authenticated', 'issue316-db-editor@example.test', '', '{}'::jsonb, '{}'::jsonb, now(), now())
    `;
    await sql`insert into public.ops_memberships (user_id, role) values (${adminId}, 'admin'), (${editorId}, 'editor')`;
  });

  afterAll(async () => {
    await sql`drop trigger if exists issue316_fail_audit on public.ops_audit_events`;
    await sql`drop function if exists public.issue316_fail_partner_audit()`;
    await sql`delete from public.ops_audit_events where target_id in (${partnerKeyOne}, ${partnerKeyTwo})`;
    await sql`delete from public.outbound_clicks where partner in (${partnerKeyOne}, ${partnerKeyTwo})`;
    await sql`delete from public.partners where key in (${partnerKeyOne}, ${partnerKeyTwo})`;
    await sql`delete from public.ops_memberships where user_id in (${adminId}, ${editorId})`;
    await sql`delete from auth.users where id in (${adminId}, ${editorId})`;
    await sql.end();
  });

  it("denies non-admin access before reading or changing partner records", async () => {
    await expect(service.listPartners(editor)).rejects.toThrow(PartnerAdministrationForbiddenError);
    await expect(service.createPartner(editor, configuration)).rejects.toThrow(
      PartnerAdministrationForbiddenError,
    );
  });

  it("creates and updates pending configuration with bounded atomic audit evidence", async () => {
    await expect(service.createPartner(admin, configuration)).resolves.toMatchObject({
      kind: "ota",
      status: "pending",
    });
    await expect(service.getPartner(admin, configuration.key)).resolves.toMatchObject({
      key: configuration.key,
      status: "pending",
    });
    await expect(
      service.updatePartner(admin, { ...configuration, cities: ["Beijing", "Shanghai"] }),
    ).resolves.toMatchObject({ status: "pending", cities: ["Beijing", "Shanghai"] });

    const audits = await sql`
      select action, target_id, metadata_jsonb
      from public.ops_audit_events
      where target_id = ${configuration.key}
      order by created_at, id
    `;
    expect(audits).toEqual([
      expect.objectContaining({
        action: "partner.created",
        metadata_jsonb: {
          changedFields: ["hosts", "categories", "cities", "trackingParam", "kind"],
        },
      }),
      expect.objectContaining({
        action: "partner.updated",
        metadata_jsonb: { changedFields: ["cities"] },
      }),
    ]);
    const serialized = JSON.stringify(audits);
    expect(serialized).not.toContain("issue316.example.com");
    expect(serialized).not.toContain("vp_click_id");
    expect(serialized).not.toContain("cookie");
    expect(serialized).not.toContain("signature");
  });

  it("rejects duplicate keys, duplicate hosts, malformed values, and implicit activation", async () => {
    await service.createPartner(admin, configuration);
    await expect(service.createPartner(admin, configuration)).rejects.toThrow(
      PartnerConfigurationConflictError,
    );
    await expect(
      service.createPartner(admin, {
        ...configuration,
        key: partnerKeyTwo,
      }),
    ).rejects.toThrow(PartnerConfigurationConflictError);
    await expect(
      service.createPartner(admin, {
        ...configuration,
        key: partnerKeyTwo,
        hosts: ["https://bad"],
      }),
    ).rejects.toThrow();
    await expect(
      service.createPartner(admin, {
        ...configuration,
        key: partnerKeyTwo,
        trackingParam: "bad param",
      }),
    ).rejects.toThrow();
    await expect(
      service.changePartnerStatus(admin, { key: configuration.key, status: "active" }),
    ).rejects.toThrow(PartnerActivationConfirmationError);
    await expect(
      service.changePartnerStatus(admin, {
        key: configuration.key,
        status: "active",
        confirmActivation: true,
      }),
    ).resolves.toMatchObject({ status: "active" });

    const statusAudits = await sql`
      select metadata_jsonb from public.ops_audit_events
      where target_id = ${configuration.key} and action = 'partner.status.changed'
    `;
    expect(statusAudits).toHaveLength(1);
    expect(statusAudits[0]?.metadata_jsonb).toEqual({
      previousStatus: "pending",
      currentStatus: "active",
    });
  });

  it("writes no audit on configuration conflict and rolls configuration back on audit failure", async () => {
    await service.createPartner(admin, configuration);
    await expect(
      service.createPartner(admin, { ...configuration, key: partnerKeyTwo }),
    ).rejects.toThrow(PartnerConfigurationConflictError);
    const conflictAudit = await sql`
      select count(*)::int as count from public.ops_audit_events where target_id = ${partnerKeyTwo}
    `;
    expect(conflictAudit[0]?.count).toBe(0);

    await sql`
      create function public.issue316_fail_partner_audit()
      returns trigger language plpgsql as $$
      begin
        if new.target_id = 'issue316_one' and new.action = 'partner.updated' then
          raise exception 'bounded test audit failure';
        end if;
        return new;
      end
      $$
    `;
    await sql`
      create trigger issue316_fail_audit before insert on public.ops_audit_events
      for each row execute function public.issue316_fail_partner_audit()
    `;
    await expect(
      service.updatePartner(admin, { ...configuration, cities: ["Chengdu"] }),
    ).rejects.toThrow();

    const [row] = await sql`
      select cities from public.partners where key = ${configuration.key}
    `;
    expect(row?.cities).toEqual(["Shanghai"]);
  });
});
