import { describe, expect, it } from "vitest";
import { prepareKnowledgeFactImport } from "./bulkImport.js";

const header =
  "collection_row_id,poi_id,city,category,name_en,name_zh,address,latitude,longitude,source_ids_json,fact_id,fact_type,value_json,confidence,fact_status,verified_at,expires_at,source_class,source_locator,evidence_summary,collection_status,researcher,reviewer,review_notes";

function row(overrides: Record<string, string> = {}): string {
  const values: Record<string, string> = {
    collection_row_id: "wave-1-001",
    poi_id: "",
    city: "Shanghai",
    category: "attraction",
    name_en: "Yu Garden",
    name_zh: "",
    address: "",
    latitude: "",
    longitude: "",
    source_ids_json: '{"official":"yu-garden"}',
    fact_id: "",
    fact_type: "booking_required",
    value_json: '{"required":true}',
    confidence: "0.9",
    fact_status: "",
    verified_at: "2026-07-16T00:00:00.000Z",
    expires_at: "2026-10-16T00:00:00.000Z",
    source_class: "official",
    source_locator: "https://example.com/yu-garden",
    evidence_summary: "Official booking policy.",
    collection_status: "reviewed",
    researcher: "researcher_1",
    reviewer: "reviewer_1",
    review_notes: "Independent review complete.",
    ...overrides,
  };
  return header
    .split(",")
    .map((key) => csvField(values[key] ?? ""))
    .join(",");
}

function csvField(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

describe("prepareKnowledgeFactImport", () => {
  it("accepts a reviewed row with typed evidence without promoting it", () => {
    const result = prepareKnowledgeFactImport(`${header}\n${row()}`);

    expect(result.errors).toEqual([]);
    expect(result.skippedRows).toEqual([]);
    expect(result.readyRows).toHaveLength(1);
    expect(result.readyRows[0]).toMatchObject({ city: "Shanghai", collectionStatus: "reviewed" });
  });

  it("returns row errors instead of coercing invalid rows", () => {
    const result = prepareKnowledgeFactImport(
      `${header}\n${row({ city: "Hangzhou", confidence: "not-a-number" })}`,
    );

    expect(result.readyRows).toEqual([]);
    expect(result.errors[0]).toMatchObject({ row: 2, collectionRowId: "wave-1-001" });
  });

  it("skips missing/conflict/rejected collection rows without treating them as evidence", () => {
    const result = prepareKnowledgeFactImport(
      `${header}\n${row({ collection_row_id: "missing-1", collection_status: "missing", verified_at: "", reviewer: "" })}`,
    );

    expect(result.errors).toEqual([]);
    expect(result.readyRows).toEqual([]);
    expect(result.skippedRows).toEqual([
      {
        row: 2,
        collectionRowId: "missing-1",
        reason: "collection_status=missing is not importable",
      },
    ]);
  });

  it("accepts an explicit missing row with blank fact fields as an honest collection gap", () => {
    const result = prepareKnowledgeFactImport(
      `${header}\n${row({
        collection_row_id: "missing-empty-1",
        source_ids_json: "",
        fact_type: "",
        value_json: "",
        confidence: "",
        source_class: "",
        source_locator: "",
        evidence_summary: "",
        collection_status: "missing",
        researcher: "",
        reviewer: "",
        verified_at: "",
      })}`,
    );

    expect(result.errors).toEqual([]);
    expect(result.skippedRows[0]).toMatchObject({ collectionRowId: "missing-empty-1" });
  });

  it("requires a real review time and independent reviewer before accepting reviewed evidence", () => {
    const result = prepareKnowledgeFactImport(
      `${header}\n${row({ verified_at: "", reviewer: "" })}`,
    );

    expect(result.readyRows).toEqual([]);
    expect(result.errors[0]?.message).toContain("reviewer is required");
  });

  it("rejects a reviewer who also researched the same row", () => {
    const result = prepareKnowledgeFactImport(`${header}\n${row({ reviewer: "Researcher_1" })}`);

    expect(result.readyRows).toEqual([]);
    expect(result.errors[0]?.message).toContain("independent from researcher");
  });

  it("applies the domain evidence privacy rules and accepts retained internal locators", () => {
    const internal = prepareKnowledgeFactImport(
      `${header}\n${row({ source_locator: "internal://retained-evidence/call-001" })}`,
    );
    const pii = prepareKnowledgeFactImport(
      `${header}\n${row({ evidence_summary: "Confirmed by editor@example.com." })}`,
    );

    expect(internal.errors).toEqual([]);
    expect(internal.readyRows).toHaveLength(1);
    expect(pii.readyRows).toEqual([]);
    expect(pii.errors[0]?.message).toContain("email address");
  });

  it("rejects future review times and invalid freshness windows", () => {
    const future = prepareKnowledgeFactImport(
      `${header}\n${row({
        verified_at: "2026-07-17T00:00:00.000Z",
        expires_at: "2026-10-17T00:00:00.000Z",
      })}`,
      new Date("2026-07-16T00:00:00.000Z"),
    );
    const reversed = prepareKnowledgeFactImport(
      `${header}\n${row({ expires_at: "2026-07-15T00:00:00.000Z" })}`,
      new Date("2026-07-16T12:00:00.000Z"),
    );

    expect(future.errors[0]?.message).toContain("must not be in the future");
    expect(reversed.errors[0]?.message).toContain("must not be earlier");
  });

  it("requires the fixed template header while allowing a UTF-8 BOM", () => {
    const withBom = prepareKnowledgeFactImport(`\uFEFF${header}\n${row()}`);
    const withExtraHeader = prepareKnowledgeFactImport(`${header},unexpected\n${row()},value`);

    expect(withBom.errors).toEqual([]);
    expect(withExtraHeader.readyRows).toEqual([]);
    expect(withExtraHeader.errors[0]?.message).toContain("unexpected");
  });
});
