import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbSeoEditorialOverrideService } from "./seoEditorialOverrideService.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const poiId = "8bdf3a4e-541b-4e01-a1f8-fec4546b7061";
const editorId = "30000000-0000-4000-8000-000000000021";

describeDatabase("database SEO editorial override service", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbSeoEditorialOverrideService(drizzle(sql, { schema }), {
    now: () => new Date("2026-08-14T00:00:00.000Z"),
  });

  beforeEach(async () => {
    await sql`delete from public.seo_editorial_overrides where poi_id = ${poiId}`;
    await sql`delete from public.pois where id = ${poiId}`;
    await sql`delete from public.ops_memberships where user_id = ${editorId}`;
    await sql`delete from auth.users where id = ${editorId}`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (${editorId}, 'authenticated', 'authenticated', 'seo-editor@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now())
    `;
    await sql`insert into public.ops_memberships (user_id, role) values (${editorId}, 'editor')`;
    await sql`
      insert into public.pois (id, city, category, name_en, source_ids)
      values (${poiId}, 'Integration City', 'attraction', 'Integration POI', '{}'::jsonb)
    `;
  });

  afterAll(async () => {
    await sql`delete from public.seo_editorial_overrides where poi_id = ${poiId}`;
    await sql`delete from public.pois where id = ${poiId}`;
    await sql`delete from public.ops_memberships where user_id = ${editorId}`;
    await sql`delete from auth.users where id = ${editorId}`;
    await sql.end();
  });

  it("upserts bounded presentation copy without creating or changing facts", async () => {
    const saved = await service.save({
      actorId: editorId,
      poiId,
      intent: "transport",
      title: "Getting to Integration POI",
      summary: null,
      emphasis: "Use only current reviewed transport facts below.",
    });
    expect(saved).toMatchObject({
      poiId,
      intent: "transport",
      title: "Getting to Integration POI",
      summary: null,
    });

    const updated = await service.save({
      actorId: editorId,
      poiId,
      intent: "transport",
      title: null,
      summary: "A bounded editorial summary.",
      emphasis: null,
    });
    expect(updated).toMatchObject({
      title: null,
      summary: "A bounded editorial summary.",
      emphasis: null,
    });
    const [row] = await sql`
      select count(*)::int as count from public.seo_editorial_overrides where poi_id = ${poiId}
    `;
    const [factRow] =
      await sql`select count(*)::int as count from public.poi_facts where poi_id = ${poiId}`;
    expect(row).toEqual({ count: 1 });
    expect(factRow).toEqual({ count: 0 });
    await expect(service.get({ poiId, intent: "transport" })).resolves.toMatchObject({
      summary: "A bounded editorial summary.",
    });
  });

  it("deletes the private row so callers fall back to generated content", async () => {
    await service.save({
      actorId: editorId,
      poiId,
      intent: "transport",
      title: "Getting to Integration POI",
      summary: null,
      emphasis: null,
    });

    await expect(service.delete({ actorId: editorId, poiId, intent: "transport" })).resolves.toBe(
      true,
    );
    await expect(service.get({ poiId, intent: "transport" })).resolves.toBeNull();
  });
});
