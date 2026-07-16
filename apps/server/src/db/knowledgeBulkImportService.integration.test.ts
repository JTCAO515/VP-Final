import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import * as schema from "./schema.js";
import {
  KnowledgeImportValidationError,
  createDbKnowledgeBulkImportService,
} from "./knowledgeBulkImportService.js";
import { createDbKnowledgeService } from "./knowledgeService.js";
import { KNOWLEDGE_FACT_IMPORT_HEADERS } from "../modules/knowledge/bulkImport.js";

const databaseUrl = process.env.DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase("database KnowledgeBulkImportService", () => {
  const sql = postgres(databaseUrl!);
  const db = drizzle(sql, { schema });
  const service = createDbKnowledgeBulkImportService(db);
  const knowledgeService = createDbKnowledgeService(db);

  beforeEach(async () => {
    await sql`
      delete from public.pois
      where source_ids ->> 'import_test' = 'v2-75'
    `;
  });

  afterAll(async () => {
    await sql`
      delete from public.pois
      where source_ids ->> 'import_test' = 'v2-75'
    `;
    await sql.end();
  });

  it("dry-runs, imports only drafts, retains private editorial evidence, and is idempotent", async () => {
    const csv = fixtureCsv();

    await expect(service.dryRun(csv)).resolves.toMatchObject({
      createdPois: 1,
      createdFacts: 1,
      errors: [],
    });
    const concurrentReports = await Promise.all([service.commit(csv), service.commit(csv)]);
    expect(concurrentReports.map((report) => report.createdFacts).sort()).toEqual([0, 1]);
    expect(concurrentReports.map((report) => report.duplicateFacts).sort()).toEqual([0, 1]);

    const facts = await sql`
      select fact.status, fact.verified_at, audit.collection_status, audit.researcher,
             audit.reviewer, audit.evidence_reviewed_at, audit.review_notes
      from public.poi_facts fact
      join public.poi_fact_editorial_audit audit on audit.fact_id = fact.id
      join public.pois poi on poi.id = fact.poi_id
      where poi.source_ids ->> 'import_test' = 'v2-75'
    `;
    expect(facts).toEqual([
      expect.objectContaining({
        status: "draft",
        verified_at: null,
        collection_status: "reviewed",
        researcher: "researcher_1",
        reviewer: "reviewer_1",
        review_notes: "Independent review complete.",
      }),
    ]);
    expect(facts[0]?.evidence_reviewed_at).not.toBeNull();

    await expect(service.commit(csv)).resolves.toMatchObject({
      createdPois: 0,
      createdFacts: 0,
      duplicateFacts: 1,
      errors: [],
    });

    await expect(
      service.dryRun(fixtureCsv({ value_json: '{"required":false}' })),
    ).resolves.toMatchObject({
      errors: [
        {
          row: 2,
          collectionRowId: "v2-75-reviewed-001",
          message: "collection_row_id already exists with different content",
        },
      ],
    });
  });

  it("merges a repeated stable POI source identity and keeps imported facts private until review", async () => {
    await service.commit(
      fixtureCsv({
        collection_row_id: "v2-75-source-001",
        fact_type: "booking_required",
        source_locator: "https://example.com/v2-75-booking",
      }),
    );
    await expect(
      service.commit(
        fixtureCsv({
          collection_row_id: "v2-75-source-002",
          name_en: "V2-75 Test Garden Updated Name",
          fact_type: "metro_access",
          value_json: '{"station":"Test Station"}',
          source_locator: "https://example.com/v2-75-metro",
        }),
      ),
    ).resolves.toMatchObject({ createdPois: 0, mergedPois: 1, createdFacts: 1 });

    await expect(
      sql`select count(*)::int as count from public.pois where source_ids ->> 'import_test' = 'v2-75'`,
    ).resolves.toEqual([{ count: 1 }]);
    const publicPois = await knowledgeService.listPois({ city: "Shanghai" });
    const importedPublicPoi = publicPois.find((poi) => poi.sourceIds.import_test === "v2-75");
    expect(importedPublicPoi).toBeDefined();
    expect(importedPublicPoi?.facts).toEqual([]);
    const editorialPois = await knowledgeService.listPois({
      city: "Shanghai",
      includeDrafts: true,
    });
    expect(editorialPois.find((poi) => poi.sourceIds.import_test === "v2-75")?.facts).toHaveLength(
      2,
    );
  });

  it("rejects an invalid file before creating any POI or fact", async () => {
    const invalid = fixtureCsv({ city: "Hangzhou" });

    await expect(service.commit(invalid)).rejects.toBeInstanceOf(KnowledgeImportValidationError);
    await expect(
      sql`select count(*)::int as count from public.pois where source_ids ->> 'import_test' = 'v2-75'`,
    ).resolves.toEqual([{ count: 0 }]);
  });
});

function fixtureCsv(overrides: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    collection_row_id: "v2-75-reviewed-001",
    poi_id: "",
    city: "Shanghai",
    category: "attraction",
    name_en: "V2-75 Test Garden",
    name_zh: "",
    address: "",
    latitude: "",
    longitude: "",
    source_ids_json: '{"import_test":"v2-75"}',
    fact_id: "",
    fact_type: "booking_required",
    value_json: '{"required":true}',
    confidence: "0.9",
    fact_status: "",
    verified_at: "2026-07-16T00:00:00.000Z",
    expires_at: "2026-10-16T00:00:00.000Z",
    source_class: "official",
    source_locator: "https://example.com/v2-75-test-garden",
    evidence_summary: "Official booking policy for the test garden.",
    collection_status: "reviewed",
    researcher: "researcher_1",
    reviewer: "reviewer_1",
    review_notes: "Independent review complete.",
    ...overrides,
  };
  return [
    KNOWLEDGE_FACT_IMPORT_HEADERS.join(","),
    KNOWLEDGE_FACT_IMPORT_HEADERS.map((key) => csvField(values[key] ?? "")).join(","),
  ].join("\n");
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}
