import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import {
  ContentAiWalkingSkeletonConflictError,
  createDbContentAiWalkingSkeletonService,
} from "./contentAiWalkingSkeletonService.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const poiId = "61000000-0000-0000-0000-000000000001";
const ownerId = "61000000-0000-4000-8000-000000000011";
const reviewerId = "61000000-0000-4000-8000-000000000012";

describeDatabase("database Content AI walking skeleton", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbContentAiWalkingSkeletonService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`drop trigger if exists content_ai_skeleton_fail_audit on public.ops_audit_events`;
    await sql`delete from public.ops_audit_events where actor_id in (${ownerId}, ${reviewerId})`;
    await sql`delete from public.content_ai_walking_skeleton_drafts where owner_id = ${ownerId}`;
    await sql`delete from public.pois where id = ${poiId}`;
    await sql`delete from public.ops_memberships where user_id in (${ownerId}, ${reviewerId})`;
    await sql`delete from auth.users where id in (${ownerId}, ${reviewerId})`;
    await sql`
      insert into auth.users (id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
      values
        (${ownerId}, 'authenticated', 'authenticated', 'content-owner@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()),
        (${reviewerId}, 'authenticated', 'authenticated', 'content-reviewer@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now())
    `;
    await sql`
      insert into public.ops_memberships (user_id, role, created_by)
      values (${reviewerId}, 'editor', ${ownerId})
    `;
    await sql`
      insert into public.pois (id, city, category, name_en, source_ids)
      values (${poiId}, 'Fixture City', 'attraction', 'Fixture POI', '{}'::jsonb)
    `;
  });

  afterAll(async () => {
    await sql`drop trigger if exists content_ai_skeleton_fail_audit on public.ops_audit_events`;
    await sql`delete from public.ops_audit_events where actor_id in (${ownerId}, ${reviewerId})`;
    await sql`delete from public.content_ai_walking_skeleton_drafts where owner_id = ${ownerId}`;
    await sql`delete from public.pois where id = ${poiId}`;
    await sql`delete from auth.users where id in (${ownerId}, ${reviewerId})`;
    await sql.end();
  });

  async function createDraft() {
    return service.createFixtureDraft({
      ownerId,
      poiId,
      afterText: "Use Exit 1 for the fixture destination.",
      sourceClass: "operator_verified",
      sourceLocator: "ops://content-ai-walking-skeleton",
      evidenceSummary: "Fixture-only observation used to verify the publish transaction.",
    });
  }

  it("keeps the draft owner-scoped until an authorized reviewer reads it", async () => {
    const draft = await createDraft();
    await expect(
      service.getDraft({ draftId: draft.id, requesterId: ownerId, canReview: false }),
    ).resolves.toMatchObject({ id: draft.id, state: "draft" });
    await expect(
      service.getDraft({
        draftId: draft.id,
        requesterId: "61000000-0000-4000-8000-000000000099",
        canReview: false,
      }),
    ).resolves.toBeNull();
    await expect(
      service.getDraft({ draftId: draft.id, requesterId: reviewerId, canReview: true }),
    ).resolves.toMatchObject({ id: draft.id });
  });

  it("publishes one displayed operation and its audit atomically", async () => {
    const draft = await createDraft();
    const published = await service.publishDraft({ draftId: draft.id, reviewerId });

    expect(published).toMatchObject({ id: draft.id, state: "published" });
    const [fact] = await sql`
      select status, version, reviewed_by from public.poi_facts where id = ${draft.factId}
    `;
    expect(fact).toMatchObject({ status: "reviewed", version: 2, reviewed_by: reviewerId });
    const [audit] = await sql`
      select action, target_id from public.ops_audit_events
      where actor_id = ${reviewerId} and target_id = ${draft.id}
    `;
    expect(audit).toMatchObject({
      action: "content_ai.walking_skeleton.published",
      target_id: draft.id,
    });
  });

  it("fails the entire publication when the displayed fact version is stale", async () => {
    const draft = await createDraft();
    await sql`update public.poi_facts set version = version + 1 where id = ${draft.factId}`;

    await expect(service.publishDraft({ draftId: draft.id, reviewerId })).rejects.toBeInstanceOf(
      ContentAiWalkingSkeletonConflictError,
    );
    const [fact] = await sql`
      select status, reviewed_by from public.poi_facts where id = ${draft.factId}
    `;
    expect(fact).toMatchObject({ status: "draft", reviewed_by: null });
    await expect(
      service.getDraft({ draftId: draft.id, requesterId: ownerId, canReview: false }),
    ).resolves.toMatchObject({ state: "conflict" });
  });

  it("rolls back the fact and draft state when publication audit persistence fails", async () => {
    const draft = await createDraft();
    await sql`
      create function public.content_ai_skeleton_fail_audit_fn() returns trigger
      language plpgsql as $$ begin raise exception 'forced audit failure'; end $$
    `;
    await sql`
      create trigger content_ai_skeleton_fail_audit before insert on public.ops_audit_events
      for each row when (new.action = 'content_ai.walking_skeleton.published')
      execute function public.content_ai_skeleton_fail_audit_fn()
    `;

    await expect(service.publishDraft({ draftId: draft.id, reviewerId })).rejects.toThrow();
    const [fact] = await sql`
      select status, version, reviewed_by from public.poi_facts where id = ${draft.factId}
    `;
    expect(fact).toMatchObject({ status: "draft", version: 1, reviewed_by: null });
    await expect(
      service.getDraft({ draftId: draft.id, requesterId: ownerId, canReview: false }),
    ).resolves.toMatchObject({ state: "draft" });
  });
});
