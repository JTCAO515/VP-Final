import { describe, expect, it } from "vitest";
import {
  PoiFactEvidenceSummarySchema,
  PoiSchema,
  derivePoiSceneTags,
  isEligiblePoiFact,
  isCurrentPoiFact,
  updatePoiFact,
  type Poi,
  type PoiFact,
} from "./index.js";
import { INITIAL_POIS } from "./seed.js";

const fact: PoiFact = {
  id: "fact-1",
  poiId: "poi-1",
  factType: "metro_access",
  value: { easy: true },
  confidence: 0.9,
  source: "editor",
  sourceClass: "reputable_editorial",
  sourceLocator: "https://example.com/fact-1",
  evidenceSummary: "The source confirms nearby metro access.",
  ingestedAt: "2026-06-30T00:00:00.000Z",
  verifiedAt: "2026-07-01T00:00:00.000Z",
  expiresAt: null,
  version: 1,
  status: "reviewed",
};

describe("PoiSchema", () => {
  it("defaults nested collections", () => {
    const poi = PoiSchema.parse({
      id: "poi-1",
      city: "Shanghai",
      category: "attraction",
      nameEn: "Yu Garden",
    });

    expect(poi.facts).toEqual([]);
    expect(poi.commercialLinks).toEqual([]);
  });
});

describe("isCurrentPoiFact", () => {
  it("hides expired facts", () => {
    expect(isCurrentPoiFact(fact, new Date("2026-07-09T00:00:00.000Z"))).toBe(true);
    expect(
      isCurrentPoiFact(
        { ...fact, expiresAt: "2026-07-08T00:00:00.000Z" },
        new Date("2026-07-09T00:00:00.000Z"),
      ),
    ).toBe(false);
  });

  it("hides every ineligible lifecycle state and incomplete evidence", () => {
    expect(isCurrentPoiFact({ ...fact, status: "deprecated" })).toBe(false);
    expect(isEligiblePoiFact({ ...fact, status: "draft" })).toBe(false);
    expect(isEligiblePoiFact({ ...fact, status: "rejected" })).toBe(false);
    expect(isEligiblePoiFact({ ...fact, status: "active" })).toBe(false);
    expect(isEligiblePoiFact({ ...fact, sourceLocator: null })).toBe(false);
    expect(isEligiblePoiFact({ ...fact, sourceClass: "user_report" })).toBe(false);
    expect(isEligiblePoiFact({ ...fact, verifiedAt: null })).toBe(false);
    expect(
      isEligiblePoiFact(
        { ...fact, verifiedAt: "2026-07-10T00:00:00.000Z" },
        new Date("2026-07-09"),
      ),
    ).toBe(false);
  });

  it("allows honest unverified drafts while rejecting PII evidence summaries", () => {
    expect(
      PoiSchema.parse({
        id: "poi-draft",
        city: "Shanghai",
        category: "attraction",
        nameEn: "Draft POI",
        facts: [
          {
            ...fact,
            id: "fact-draft",
            sourceClass: null,
            sourceLocator: null,
            evidenceSummary: null,
            verifiedAt: null,
            status: "draft",
          },
        ],
      }).facts[0]?.verifiedAt,
    ).toBeNull();
    expect(
      PoiFactEvidenceSummarySchema.safeParse("Email editor@example.com for proof").success,
    ).toBe(false);
    expect(PoiFactEvidenceSummarySchema.safeParse("Call +86 138 0013 8000").success).toBe(false);
  });
});

describe("updatePoiFact", () => {
  it("updates a fact in a POI collection", () => {
    const updated = updatePoiFact(INITIAL_POIS, "fact-yu-garden-metro", {
      label: "Updated metro note",
    });

    expect(updated[0]?.facts[0]?.value).toEqual({ label: "Updated metro note" });
    expect(updated[0]?.facts[0]?.version).toBe(2);
  });
});

describe("derivePoiSceneTags", () => {
  it("derives traveler scene tags from current facts", () => {
    expect(derivePoiSceneTags(INITIAL_POIS[0] as Poi)).toEqual(["Near metro"]);
    expect(derivePoiSceneTags(INITIAL_POIS[1] as Poi)).toEqual(["Low Mandarin"]);
  });

  it("does not invent tags without facts", () => {
    expect(
      derivePoiSceneTags({
        id: "poi-empty",
        city: "Shanghai",
        category: "shopping",
        nameEn: "Empty Mall",
        sourceIds: {},
        commercialLinks: [],
        facts: [],
      }),
    ).toEqual([]);
  });

  it("ignores expired facts", () => {
    expect(
      derivePoiSceneTags(
        {
          id: "poi-expired",
          city: "Beijing",
          category: "attraction",
          nameEn: "Old Fact",
          sourceIds: {},
          commercialLinks: [],
          facts: [{ ...fact, factType: "rainy_fit", expiresAt: "2026-07-08T00:00:00.000Z" }],
        },
        new Date("2026-07-09T00:00:00.000Z"),
      ),
    ).toEqual([]);
  });
});
