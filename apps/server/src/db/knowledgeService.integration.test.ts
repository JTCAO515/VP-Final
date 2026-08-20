import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import { createDbKnowledgeService } from "./knowledgeService.js";
import type { OpsAccess } from "../modules/opsAuthorization/service.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
const poiId = "30000000-0000-0000-0000-000000000001";
const reviewerId = "30000000-0000-4000-8000-000000000011";
const knowledgeEditor: OpsAccess = {
  userId: reviewerId,
  role: "editor",
  permissions: ["knowledge.read", "knowledge.write"],
};

describeDatabase("database KnowledgeService", () => {
  const sql = postgres(databaseUrl!);
  const service = createDbKnowledgeService(drizzle(sql, { schema }));

  beforeEach(async () => {
    await sql`delete from public.ops_audit_events where actor_id = ${reviewerId}`;
    await sql`delete from public.knowledge_gaps where city = 'Evidence City'`;
    await sql`delete from public.scoped_execution_facts where reviewed_by = ${reviewerId} or reviewed_by is null`;
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
    await sql`delete from public.scoped_execution_facts where reviewed_by = ${reviewerId} or reviewed_by is null`;
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

    const reviewed = await service.approveDraftFact({
      factId: created.id,
      reviewedBy: reviewerId,
      expectedVersion: created.version,
    });
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

  it("persists, reviews, retrieves, and audits a scoped fact", async () => {
    const created = await service.createScopedFact({
      actor: knowledgeEditor,
      target: { scope: "national", countryCode: "CN" },
      factType: "payment_acceptance",
      value: { summary: "Database fixture only" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/scoped-payment",
      evidenceSummary: "Official fixture evidence for scoped payment guidance.",
    });
    expect(created).toMatchObject({ status: "draft", verifiedAt: null, version: 1 });
    await expect(
      service.retrieveScopedFacts({ context: {}, factTypes: ["payment_acceptance"] }),
    ).resolves.toEqual({ facts: [], ambiguities: [] });

    const reviewed = await service.reviewScopedFact({
      actor: knowledgeEditor,
      factId: created.id,
      expectedVersion: created.version,
    });
    expect(reviewed).toMatchObject({
      status: "updated",
      fact: { id: created.id, status: "reviewed", reviewPolicy: "volatile-30d-v1", version: 2 },
    });
    await expect(
      service.retrieveScopedFacts({ context: {}, factTypes: ["payment_acceptance"] }),
    ).resolves.toMatchObject({ facts: [{ id: created.id }], ambiguities: [] });

    const auditRows = await sql`
      select action, target_id, metadata_jsonb from public.ops_audit_events
      where actor_id = ${reviewerId} and target_id = ${created.id}
      order by created_at asc
    `;
    expect(auditRows).toEqual([
      {
        action: "knowledge.scoped_fact.create.completed",
        target_id: created.id,
        metadata_jsonb: { scope: "national", factType: "payment_acceptance", version: 1 },
      },
      {
        action: "knowledge.scoped_fact.review.completed",
        target_id: created.id,
        metadata_jsonb: { reviewPolicy: "volatile-30d-v1", version: 2 },
      },
    ]);
  });

  it("checks permission before a scoped fact lookup", async () => {
    await expect(
      service.updateScopedFact({
        actor: { userId: reviewerId, role: "operator", permissions: [] },
        factId: crypto.randomUUID(),
        expectedVersion: 1,
        value: { summary: "must not be read" },
      }),
    ).rejects.toThrow("Forbidden Ops permission");
  });

  it("rolls back a scoped fact mutation when its audit row cannot be written", async () => {
    const missingActor: OpsAccess = {
      userId: "30000000-0000-4000-8000-000000000099",
      role: "editor",
      permissions: ["knowledge.read", "knowledge.write"],
    };
    await expect(
      service.createScopedFact({
        actor: missingActor,
        target: { scope: "national", countryCode: "CN" },
        factType: "network_setup",
        value: { summary: "must roll back" },
        confidence: 0.8,
        sourceClass: "official",
        sourceLocator: "https://example.com/audit-rollback",
        evidenceSummary: "Fixture evidence for an intentional audit failure.",
      }),
    ).rejects.toMatchObject({ code: "23503" });
    const [count] = await sql`
      select count(*)::integer as count from public.scoped_execution_facts
      where source_locator = 'https://example.com/audit-rollback'
    `;
    expect(count).toEqual({ count: 0 });
  });

  it("does not overwrite a scoped fact after an optimistic conflict", async () => {
    const created = await service.createScopedFact({
      actor: knowledgeEditor,
      target: { scope: "scene", sceneKey: "network" },
      factType: "network_setup",
      value: { summary: "Version one" },
      confidence: 0.8,
      sourceClass: "official",
      sourceLocator: "https://example.com/scoped-network-one",
      evidenceSummary: "Official fixture evidence version one.",
    });
    const updated = await service.updateScopedFact({
      actor: knowledgeEditor,
      factId: created.id,
      expectedVersion: created.version,
      value: { summary: "Version two" },
    });
    expect(updated).toMatchObject({ status: "updated", fact: { version: 2 } });
    await expect(
      service.updateScopedFact({
        actor: knowledgeEditor,
        factId: created.id,
        expectedVersion: created.version,
        value: { summary: "Stale overwrite" },
      }),
    ).resolves.toEqual({
      status: "conflict",
      reason: "stale_version",
      expectedVersion: 1,
      currentVersion: 2,
    });
    const [row] = await sql`
      select value_jsonb, version from public.scoped_execution_facts where id = ${created.id}
    `;
    expect(row).toEqual({ value_jsonb: { summary: "Version two" }, version: 2 });
  });

  it("does not approve a draft that changed after the reviewer opened it", async () => {
    const created = await service.createFact({
      poiId,
      factType: "metro_access",
      value: { label: "Near metro exit 1" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/metro-version-one",
      evidenceSummary: "The official source confirms a nearby metro entrance.",
    });
    await service.updateFact({
      factId: created.id,
      value: { label: "Near metro exit 2" },
      sourceLocator: "https://example.com/metro-version-two",
    });

    await expect(
      service.approveDraftFact({
        factId: created.id,
        reviewedBy: reviewerId,
        expectedVersion: created.version,
      }),
    ).rejects.toThrow("no longer the unreviewed draft shown for confirmation");

    const [current] = await sql`
      select version, status, reviewed_by from public.poi_facts where id = ${created.id}
    `;
    expect(current).toMatchObject({
      version: created.version + 1,
      status: "draft",
      reviewed_by: null,
    });
  });

  it("persists canonical POI creation and edits without creating a fact", async () => {
    const created = await service.createPoi({
      actorId: reviewerId,
      city: "Canonical City",
      category: "attraction",
      nameEn: "Canonical Place",
      nameZh: "规范地点",
      latitude: 31.227,
      longitude: 121.492,
    });
    const updated = await service.updatePoi({
      actorId: reviewerId,
      id: created.id,
      city: "Canonical City",
      category: "attraction",
      nameEn: "Canonical Place Revised",
      nameZh: null,
      latitude: null,
      longitude: null,
    });

    expect(updated).toMatchObject({
      id: created.id,
      nameEn: "Canonical Place Revised",
      facts: [],
    });
    await expect(service.listPois({ city: "Canonical City" })).resolves.toEqual([
      expect.objectContaining({ id: created.id, nameEn: "Canonical Place Revised", facts: [] }),
    ]);
    const auditRows = await sql`
      select action, target_id, metadata_jsonb from public.ops_audit_events
      where actor_id = ${reviewerId} and target_id = ${created.id}
      order by created_at asc
    `;
    expect(auditRows).toEqual([
      {
        action: "knowledge.poi.create.completed",
        target_id: created.id,
        metadata_jsonb: {
          fields: ["city", "category", "nameEn", "nameZh", "latitude", "longitude"],
        },
      },
      {
        action: "knowledge.poi.update.completed",
        target_id: created.id,
        metadata_jsonb: {
          fields: ["city", "category", "nameEn", "nameZh", "latitude", "longitude"],
        },
      },
    ]);
    await sql`delete from public.pois where id = ${created.id}`;
  });

  it("persists local-display provenance as a draft and rejects an untyped address value", async () => {
    const created = await service.createFact({
      poiId,
      factType: "local_address_zh",
      value: { text: "上海市黄浦区豫园路279号" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/official-local-address",
      evidenceSummary: "The official source publishes the Chinese visitor address.",
    });

    expect(created).toMatchObject({
      value: { text: "上海市黄浦区豫园路279号" },
      sourceClass: "official",
      sourceLocator: "https://example.com/official-local-address",
      status: "draft",
      verifiedAt: null,
    });
    await expect(
      service.updateFact({ factId: created.id, value: { label: "not an address value" } }),
    ).rejects.toThrow();
    await expect(
      service.updateFact({ factId: created.id, value: { text: "x".repeat(501) } }),
    ).rejects.toThrow();
  });

  it("returns private import grouping to Ops only and records a per-fact rejection", async () => {
    const reviewedSibling = await service.createFact({
      poiId,
      factType: "metro_access",
      value: { label: "Near metro exit 1" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/metro-reviewed",
      evidenceSummary: "The official source confirms the metro exit.",
    });
    await service.approveDraftFact({
      factId: reviewedSibling.id,
      reviewedBy: reviewerId,
      expectedVersion: reviewedSibling.version,
    });
    const draft = await service.createFact({
      poiId,
      factType: "local_name_zh",
      value: { text: "豫园" },
      confidence: 0.9,
      sourceClass: "official",
      sourceLocator: "https://example.com/local-name",
      evidenceSummary: "The official source publishes the Chinese venue name.",
    });
    const batchId = crypto.randomUUID();
    const collectionRowId = `queue-row-${draft.id}`;
    await sql`insert into public.knowledge_import_batches (id) values (${batchId})`;
    await sql`
      insert into public.poi_fact_editorial_audit (
        fact_id, collection_row_id, content_digest, collection_status, researcher, import_batch_id
      ) values (${draft.id}, ${collectionRowId}, repeat('a', 64), 'researched', 'researcher-1', ${batchId})
    `;

    const [item] = await service.listDraftFactReviewQueue({ importBatchId: batchId });
    expect(item).toMatchObject({
      poi: { id: poiId, nameEn: "Integration POI" },
      draft: { id: draft.id, status: "draft" },
      importContext: {
        importBatchId: batchId,
        collectionStatus: "researched",
      },
      reviewedSiblings: [{ id: reviewedSibling.id, status: "reviewed" }],
    });
    expect(JSON.stringify(item)).not.toContain("researcher-1");

    await expect(
      service.rejectFact({ factId: draft.id, rejectedBy: reviewerId }),
    ).resolves.toMatchObject({ id: draft.id, status: "rejected" });
    await expect(service.listDraftFactReviewQueue({ importBatchId: batchId })).resolves.toEqual([]);
    const [audit] = await sql`
      select action, target_id from public.ops_audit_events
      where actor_id = ${reviewerId} and target_id = ${draft.id}
      order by created_at desc
      limit 1
    `;
    expect(audit).toEqual({
      action: "knowledge.fact.review.rejected",
      target_id: draft.id,
    });
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
    const reviewed = await service.approveDraftFact({
      factId: created.id,
      reviewedBy: reviewerId,
      expectedVersion: created.version,
    });
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
