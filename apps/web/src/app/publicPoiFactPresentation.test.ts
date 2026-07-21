import { describe, expect, it } from "vitest";
import { PoiFactSchema, resolvePoiFactReview, type PoiFact } from "@visepanda/domain";
import { projectPublicPoiFactProvenance, toPublicPoiFact } from "./publicPoiFactPresentation";

const NOW = new Date("2026-07-16T00:00:00.000Z");

function fact(overrides: Partial<PoiFact> = {}): PoiFact {
  const factType = overrides.factType ?? "metro_access";
  const review = resolvePoiFactReview({
    factType,
    verifiedAt: new Date("2026-07-15T00:00:00.000Z"),
  });
  return PoiFactSchema.parse({
    id: "fact-1",
    poiId: "poi-1",
    factType,
    value: { label: "Easy by metro" },
    confidence: 0.9,
    source: "official",
    sourceClass: "official",
    sourceLocator: "https://example.test/private-source-locator",
    evidenceSummary: "Private evidence summary retained outside the public projection.",
    ingestedAt: "2026-07-14T00:00:00.000Z",
    verifiedAt: "2026-07-15T00:00:00.000Z",
    expiresAt: review.expiresAt,
    reviewPolicy: review.reviewPolicy,
    version: 1,
    status: "reviewed",
    ...overrides,
  });
}

describe("projectPublicPoiFactProvenance", () => {
  it.each([
    ["official", "Official source"],
    ["operator_verified", "Operator verified"],
    ["reputable_editorial", "Independent editorial"],
  ] as const)("projects %s without private evidence", (sourceClass, sourceLabel) => {
    const projection = projectPublicPoiFactProvenance(fact({ sourceClass }), NOW);

    expect(projection).toEqual({
      sourceClass,
      sourceLabel,
      verifiedAt: "2026-07-15T00:00:00.000Z",
      verifiedDateLabel: "Jul 15, 2026",
    });
    expect(JSON.stringify(projection)).not.toContain("private-source-locator");
    expect(JSON.stringify(projection)).not.toContain("Private evidence summary");
    expect(JSON.stringify(projection)).not.toContain("reviewedBy");
  });

  it.each(["user_report", "model_output", "uncorroborated_scrape"] as const)(
    "fails closed for unsupported source class %s",
    (sourceClass) => {
      expect(projectPublicPoiFactProvenance(fact({ sourceClass }), NOW)).toBeNull();
    },
  );

  it("hides incomplete, expired, draft, deprecated, and unlabeled facts", () => {
    expect(projectPublicPoiFactProvenance(fact({ verifiedAt: null }), NOW)).toBeNull();
    expect(
      projectPublicPoiFactProvenance(fact({ expiresAt: "2026-07-15T00:00:00.000Z" }), NOW),
    ).toBeNull();
    expect(projectPublicPoiFactProvenance(fact({ status: "draft" }), NOW)).toBeNull();
    expect(projectPublicPoiFactProvenance(fact({ status: "deprecated" }), NOW)).toBeNull();
    expect(toPublicPoiFact(fact({ value: {} }), NOW)).toBeNull();
  });
});
