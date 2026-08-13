import { describe, expect, it } from "vitest";
import { PoiFactSchema, type Poi, type PoiFact } from "@visepanda/domain";
import { resolvePublicSeoPage } from "./seo-page-model";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function fact(id: string, factType: string, overrides: Record<string, unknown> = {}): PoiFact {
  return PoiFactSchema.parse({
    id,
    poiId: "poi-yu-garden",
    factType,
    value: { label: `${factType} fact` },
    confidence: 0.9,
    source: "editorial",
    sourceClass: "reputable_editorial",
    sourceLocator: `https://example.test/${id}`,
    evidenceSummary: "An editor independently confirmed this bounded fixture.",
    ingestedAt: "2026-08-01T00:00:00.000Z",
    verifiedAt: "2026-08-10T00:00:00.000Z",
    expiresAt: "2026-11-08T00:00:00.000Z",
    reviewPolicy: "execution-90d-v1",
    version: 1,
    status: "reviewed",
    ...overrides,
  });
}

function poi(facts: PoiFact[]): Poi {
  return {
    id: "poi-yu-garden",
    city: "Shanghai",
    category: "attraction",
    nameEn: "Yu Garden",
    facts,
    commercialLinks: [],
    sourceIds: {},
  };
}

describe("resolvePublicSeoPage", () => {
  it("returns only the candidate's current reviewed support facts", () => {
    const page = resolvePublicSeoPage(
      [poi([fact("metro", "metro_access"), fact("unrelated", "english_menu")])],
      { citySlug: "shanghai", poiSlug: "yu-garden", intentSegment: "transport" },
      NOW,
    );

    expect(page?.candidate.canonicalPath).toBe("/shanghai/yu-garden/transport");
    expect(page?.facts.map((entry) => entry.id)).toEqual(["metro"]);
    expect(page?.facts[0]?.provenance.verifiedAt).toBe("2026-08-10T00:00:00.000Z");
  });

  it("returns no page for an invalid intent or evidence that has expired", () => {
    const expired = [
      poi([fact("metro", "metro_access", { expiresAt: "2026-08-12T00:00:00.000Z" })]),
    ];

    expect(
      resolvePublicSeoPage(
        expired,
        { citySlug: "shanghai", poiSlug: "yu-garden", intentSegment: "transport" },
        NOW,
      ),
    ).toBeNull();
    expect(
      resolvePublicSeoPage(
        [poi([fact("metro", "metro_access")])],
        { citySlug: "shanghai", poiSlug: "yu-garden", intentSegment: "invented" },
        NOW,
      ),
    ).toBeNull();
  });
});
