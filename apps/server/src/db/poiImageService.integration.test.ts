import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbPoiImageService } from "./poiImageService.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const actorId = "56000000-0000-4000-8000-000000000001";

describeDatabase("database PoiImageService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbPoiImageService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`drop trigger if exists issue442_fail_audit on public.ops_audit_events`;
    await sql`drop function if exists public.issue442_fail_poi_image_audit()`;
    await sql`delete from public.ops_audit_events where actor_id = ${actorId}`;
    await sql`delete from public.poi_images where created_by = ${actorId}`;
    await sql`delete from auth.users where id = ${actorId}`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (
        ${actorId}, 'authenticated', 'authenticated', 'poi-image-editor@example.test', '',
        '{}'::jsonb, '{}'::jsonb, now(), now()
      )
    `;
  });

  afterAll(async () => {
    await sql`drop trigger if exists issue442_fail_audit on public.ops_audit_events`;
    await sql`drop function if exists public.issue442_fail_poi_image_audit()`;
    await sql`delete from public.ops_audit_events where actor_id = ${actorId}`;
    await sql`delete from public.poi_images where created_by = ${actorId}`;
    await sql`delete from auth.users where id = ${actorId}`;
    await sql.end();
  });

  it("commits private metadata and bounded audit evidence together, then soft-revokes it", async () => {
    const image = await service.create(imageInput());
    expect(image).toMatchObject({
      target: { kind: "city", city: "Image Test City" },
      contentType: "image/webp",
      deletedAt: null,
    });
    await expect(service.listActive()).resolves.toEqual([
      expect.objectContaining({ id: image.id }),
    ]);

    const revoked = await service.revoke({ imageId: image.id, actorId });
    expect(revoked).toMatchObject({ id: image.id, deletedAt: expect.any(String) });
    await expect(service.getActive(image.id)).resolves.toBeNull();
    await expect(service.listActive()).resolves.toEqual([]);

    const audits = await sql`
      select action, target_id, metadata_jsonb
      from public.ops_audit_events
      where actor_id = ${actorId}
      order by created_at, id
    `;
    expect(audits).toEqual([
      {
        action: "knowledge.poi_image.create.completed",
        target_id: image.id,
        metadata_jsonb: { targetKind: "city" },
      },
      {
        action: "knowledge.poi_image.delete.completed",
        target_id: image.id,
        metadata_jsonb: { targetKind: "city" },
      },
    ]);
    expect(JSON.stringify(audits)).not.toContain("attribution");
    expect(JSON.stringify(audits)).not.toContain("license");
  });

  it("rolls back the metadata write when its required audit insert fails", async () => {
    await sql`
      create function public.issue442_fail_poi_image_audit()
      returns trigger language plpgsql as $$
      begin
        if new.action = 'knowledge.poi_image.create.completed' then
          raise exception 'bounded image audit failure';
        end if;
        return new;
      end
      $$
    `;
    await sql`
      create trigger issue442_fail_audit before insert on public.ops_audit_events
      for each row execute function public.issue442_fail_poi_image_audit()
    `;

    await expect(service.create(imageInput())).rejects.toThrow("bounded image audit failure");
    const rows =
      await sql`select count(*)::int as count from public.poi_images where created_by = ${actorId}`;
    expect(rows[0]?.count).toBe(0);
  });
});

function imageInput() {
  return {
    target: { kind: "city" as const, city: "Image Test City" },
    attribution: "Licensed test collection",
    licenseNote: "Test-only editorial license",
    actorId,
    storagePath: `editorial/56000000-0000-4000-8000-${crypto.randomUUID().slice(0, 12)}.webp`,
    byteSize: 256,
    width: 16,
    height: 16,
  };
}
