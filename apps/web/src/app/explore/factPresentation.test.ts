import { describe, expect, it } from "vitest";
import { PoiFactSchema, type Poi, type PoiFact } from "@visepanda/domain";
import { deriveExploreFacts } from "./factPresentation";

const NOW = new Date("2026-07-16T00:00:00.000Z");

function fact(overrides: Partial<PoiFact> = {}): PoiFact {
  return PoiFactSchema.parse({
    id: "fact-1",
    poiId: "poi-1",
    factType: "metro_access",
    value: { label: "Easy by metro" },
    confidence: 0.9,
    source: "official",
    sourceClass: "official",
    sourceLocator: "https://example.test/official-source",
    evidenceSummary: "Official visitor information reviewed by operations.",
    ingestedAt: "2026-07-14T00:00:00.000Z",
    verifiedAt: "2026-07-15T00:00:00.000Z",
    expiresAt: null,
    version: 1,
    status: "reviewed",
    ...overrides,
  });
}

function poi(facts: PoiFact[]): Poi {
  return {
    id: "poi-1",
    city: "Shanghai",
    category: "attraction",
    nameEn: "Example place",
    sourceIds: {},
    facts,
    commercialLinks: [],
  };
}

describe("deriveExploreFacts", () => {
  it("maps supported reviewed facts to short, scannable labels", () => {
    expect(
      deriveExploreFacts(
        poi([
          fact(),
          fact({
            id: "fact-2",
            factType: "payment_acceptance",
            value: { label: "Foreign cards accepted" },
          }),
          fact({
            id: "fact-3",
            factType: "booking_required",
            value: { label: "Passport booking required" },
          }),
        ]),
        NOW,
      ),
    ).toEqual([
      { id: "fact-1", kind: "Metro", label: "Easy by metro" },
      { id: "fact-2", kind: "Payment", label: "Foreign cards accepted" },
      { id: "fact-3", kind: "Booking", label: "Passport booking required" },
    ]);
  });

  it("hides expired, unreviewed, and deprecated facts", () => {
    expect(
      deriveExploreFacts(
        poi([
          fact({ id: "expired", expiresAt: "2026-07-15T00:00:00.000Z" }),
          fact({ id: "draft", status: "draft" }),
          fact({ id: "deprecated", status: "deprecated" }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });

  it("does not invent copy for unsupported or unlabeled facts", () => {
    expect(
      deriveExploreFacts(
        poi([
          fact({ id: "score", factType: "rating", value: { score: 4.9 } }),
          fact({ id: "payment", factType: "payment_acceptance", value: { cards: true } }),
          fact({ id: "blank", factType: "crowd_pattern", value: { label: "  " } }),
        ]),
        NOW,
      ),
    ).toEqual([]);
  });
});
