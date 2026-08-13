import { describe, expect, it } from "vitest";
import { PoiFactSchema, type Poi, type PoiFact } from "@visepanda/domain";
import { buildEvidenceGatedSitemapEntries } from "./seo-index-model";

const NOW = new Date("2026-08-14T00:00:00.000Z");

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

describe("evidence-gated sitemap model", () => {
  it("includes only current eligible POI/intent paths with canonical URLs", () => {
    const entries = buildEvidenceGatedSitemapEntries([poi([fact("metro", "metro_access")])], {
      baseUrl: "https://www.go2china.space/",
      now: NOW,
    });

    expect(entries).toEqual([
      {
        url: "https://www.go2china.space/shanghai/yu-garden/transport",
        lastModified: new Date("2026-08-10T00:00:00.000Z"),
        changeFrequency: "weekly",
      },
    ]);
  });

  it("excludes draft and expired facts instead of creating thin index URLs", () => {
    const entries = buildEvidenceGatedSitemapEntries(
      [
        poi([
          fact("draft", "metro_access", { status: "draft", verifiedAt: null, reviewPolicy: null }),
          fact("expired", "booking_required", { expiresAt: "2026-08-13T00:00:00.000Z" }),
        ]),
      ],
      { now: NOW },
    );

    expect(entries).toEqual([]);
  });
});
