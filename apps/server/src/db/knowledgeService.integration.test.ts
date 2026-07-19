import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbKnowledgeService } from "./knowledgeService.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const poiId = "30000000-0000-0000-0000-000000000001";
const reviewerId = "30000000-0000-4000-8000-000000000011";

describeDatabase("database KnowledgeService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbKnowledgeService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`delete from public.ops_audit_events where actor_id = ${reviewerId}`;
    await sql`delete from public.knowledge_gaps where city = 'Evidence City'`;
    await sql`delete from public.pois where id = ${poiId}`;
    await sql`delete from public.ops_memberships where user_id = ${reviewerId}`;
    await sql`delete from auth.users where id = ${reviewerId}`;
    await sql`
      insert into auth.users (
        id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
        created_at, updated_at
      ) values (${reviewerId}, 'authenticated', 'authenticated', 'reviewer-test@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now())
    `;
    await sql`insert into public.ops_memberships (user_id, role) values (${reviewerId}, 'editor')`;
    await sql`
      insert into public.pois (id, city, category, name_en, source_ids)
      values (${poiId}, 'Integration City', 'attraction', 'Integration POI', '{}'::jsonb)
    `;
  });

  afterAll(async () => {
    await sql`delete from public.ops_audit_events where actor_id = ${reviewerId}`;
    await sql`delete from public.knowledge_gaps where city = 'Evidence City'`;
    await sql`delete from public.pois where id = ${poiId}`;
    await sql`delete from public.ops_memberships where user_id = ${reviewerId}`;
    await sql`delete from auth.users where id = ${reviewerId}`;
    await sql.end();
  });

  it("persists a draft and exposes it only after explicit review", async () => {
    const created = await service.createFact({
      poiId,
      factType: "metro_access",
      value: { label: "Near metro" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/integration-source",
      evidenceSummary: "The official source confirms nearby metro access.",
    });

    expect(created).toMatchObject({ status: "draft", verifiedAt: null });
    await expect(service.listPois({ city: "Integration City" })).resolves.toMatchObject([
      { id: poiId, facts: [] },
    ]);

    const reviewed = await service.renewFact({ factId: created.id, reviewedBy: reviewerId });
    expect(reviewed).toMatchObject({
      id: created.id,
      status: "reviewed",
      reviewPolicy: "execution-90d-v1",
    });
    const [privateRow] = await sql`
      select reviewed_by, review_policy from public.poi_facts where id = ${created.id}
    `;
    expect(privateRow).toMatchObject({
      reviewed_by: reviewerId,
      review_policy: "execution-90d-v1",
    });
    const [audit] = await sql`
      select action, target_id from public.ops_audit_events
      where actor_id = ${reviewerId} and target_id = ${created.id}
    `;
    expect(audit).toMatchObject({
      action: "knowledge.fact.review.completed",
      target_id: created.id,
    });
    await expect(service.listPois({ city: "Integration City" })).resolves.toMatchObject([
      { id: poiId, facts: [{ id: created.id, status: "reviewed" }] },
    ]);
  });

  it("demotes edited reviewed facts and preserves ingestion time", async () => {
    const created = await service.createFact({
      poiId,
      factType: "hours",
      value: { label: "Open daily" },
      confidence: 0.8,
      sourceClass: "official",
      sourceLocator: "https://example.com/hours",
      evidenceSummary: "The official page publishes daily opening hours.",
    });
    const reviewed = await service.renewFact({ factId: created.id, reviewedBy: reviewerId });
    const updatedPois = await service.updateFact({
      factId: created.id,
      value: { label: "Hours changed; review required" },
    });
    const updated = updatedPois
      .find((poi) => poi.id === poiId)
      ?.facts.find((fact) => fact.id === created.id);

    expect(updated).toMatchObject({ status: "draft", verifiedAt: null });
    expect(updated?.ingestedAt).toBe(created.ingestedAt);
    expect(reviewed?.verifiedAt).not.toBeNull();
    await expect(service.listPois({ city: "Integration City" })).resolves.toMatchObject([
      { id: poiId, facts: [] },
    ]);
  });

  it("atomically creates a sanitized evidence gap and PII-free audit", async () => {
    const gap = await service.recordEvidenceGap({
      question: "Can traveler@example.com find an accessible station entrance?",
      city: "Evidence City",
      actorId: reviewerId,
      taskId: "30000000-0000-4000-8000-000000000021",
      evidenceId: "30000000-0000-4000-8000-000000000022",
    });

    expect(gap).toMatchObject({
      questionPattern: "can private email find an accessible station entrance",
      city: "Evidence City",
      status: "open",
    });
    const [audit] = await sql`
      select action, target_id, metadata_jsonb from public.ops_audit_events
      where actor_id = ${reviewerId} and action = 'human_task.evidence.gap.proposed'
    `;
    expect(audit).toMatchObject({
      target_id: gap.id,
      metadata_jsonb: {
        taskId: "30000000-0000-4000-8000-000000000021",
        evidenceId: "30000000-0000-4000-8000-000000000022",
      },
    });
    expect(JSON.stringify(audit)).not.toContain("traveler@example.com");

    await expect(
      service.recordEvidenceGap({
        question: "Can traveler John Smith use passport E12345678 at this station?",
        city: "Evidence City",
        actorId: reviewerId,
        taskId: "30000000-0000-4000-8000-000000000021",
        evidenceId: "30000000-0000-4000-8000-000000000022",
      }),
    ).rejects.toMatchObject({ code: "SENSITIVE_HUMAN_TASK_EVIDENCE" });
  });
});
