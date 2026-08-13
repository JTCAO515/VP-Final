import { describe, expect, it } from "vitest";
import { PoiFactSchema, type PoiFact } from "../knowledge/index.js";
import { deriveSeoPageMatrix } from "./index.js";

const NOW = new Date("2026-08-13T00:00:00.000Z");

function poi(facts: PoiFact[]) {
  return {
    id: "poi-yu-garden",
    city: "Shanghai",
    category: "attraction" as const,
    nameEn: "Yu Garden",
    facts,
  };
}

function fact(id: string, factType: string, overrides: Record<string, unknown> = {}): PoiFact {
  return PoiFactSchema.parse({
    id,
    poiId: "poi-yu-garden",
    factType,
    value: { label: factType },
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

describe("deriveSeoPageMatrix", () => {
  it("emits unique, evidence-backed candidate paths with their supporting receipt ids", () => {
    const matrix = deriveSeoPageMatrix(
      [
        poi([
          fact("metro", "metro_access"),
          fact("booking", "booking_required", {
            expiresAt: "2026-09-09T00:00:00.000Z",
            reviewPolicy: "volatile-30d-v1",
          }),
        ]),
      ],
      NOW,
    );

    expect(matrix.pages.map((page) => page.canonicalPath)).toEqual([
      "/shanghai/yu-garden/transport",
      "/shanghai/yu-garden/ticket",
      "/shanghai/yu-garden/first-timer",
    ]);
    expect(matrix.pages.find((page) => page.intent === "first_timer")?.supportingFactIds).toEqual([
      "booking",
      "metro",
    ]);
    expect(new Set(matrix.pages.map((page) => page.canonicalPath)).size).toBe(matrix.pages.length);
  });

  it("never turns expired, draft, unsupported, or incomplete evidence into a public candidate", () => {
    const matrix = deriveSeoPageMatrix(
      [
        poi([
          fact("expired", "metro_access", { expiresAt: "2026-08-12T00:00:00.000Z" }),
          fact("draft", "payment_acceptance", {
            status: "draft",
            verifiedAt: null,
            expiresAt: null,
            reviewPolicy: null,
          }),
          fact("unsupported", "rainy_fit", { sourceClass: "model_output" }),
        ]),
      ],
      NOW,
    );

    expect(matrix.pages).toEqual([]);
    expect(matrix.gaps).toHaveLength(5);
    expect(matrix.gaps.every((gap) => gap.reason === "insufficient_current_reviewed_facts")).toBe(
      true,
    );
  });

  it("uses a deterministic candidate order and keeps a candidate bounded when duplicate facts exist", () => {
    const matrix = deriveSeoPageMatrix(
      [poi([fact("metro-b", "metro_access"), fact("metro-a", "metro_access")])],
      NOW,
    );

    expect(matrix.pages).toHaveLength(1);
    expect(matrix.pages[0]?.supportingFactIds).toEqual(["metro-a", "metro-b"]);
    expect(matrix.pages[0]?.lastVerifiedAt).toBe("2026-08-10T00:00:00.000Z");
  });
});
