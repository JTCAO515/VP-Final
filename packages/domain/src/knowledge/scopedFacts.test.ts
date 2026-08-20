import { describe, expect, it } from "vitest";
import { PoiFactSchema } from "./index.js";
import {
  ExecutionFactTargetSchema,
  ScopedExecutionFactSchema,
  deriveExecutionFactTargetOrder,
  executionFactTargetKey,
  isEligibleScopedExecutionFact,
  resolveExecutionFactVersion,
  type ExecutionFactTarget,
} from "./scopedFacts.js";

const reviewedFact = {
  id: "fact-payment-1",
  target: { scope: "national", countryCode: "CN" },
  factType: "payment_acceptance",
  value: { summary: "Reviewed fixture only." },
  confidence: 0.95,
  source: "https://example.com/official-payment-guidance",
  sourceClass: "official",
  sourceLocator: "https://example.com/official-payment-guidance",
  evidenceSummary: "Fixture evidence for the scoped-fact domain contract.",
  ingestedAt: "2026-08-19T00:00:00.000Z",
  verifiedAt: "2026-08-20T00:00:00.000Z",
  expiresAt: "2026-09-19T00:00:00.000Z",
  reviewPolicy: "volatile-30d-v1",
  version: 2,
  status: "reviewed",
} as const;

describe("scoped execution facts", () => {
  it("accepts exactly one closed target shape and rejects conflicting fields", () => {
    expect(ExecutionFactTargetSchema.parse({ scope: "poi", poiId: "poi-1" })).toEqual({
      scope: "poi",
      poiId: "poi-1",
    });
    expect(ExecutionFactTargetSchema.safeParse({ scope: "poi" }).success).toBe(false);
    expect(
      ExecutionFactTargetSchema.safeParse({ scope: "poi", poiId: "poi-1", city: "shanghai" })
        .success,
    ).toBe(false);
    expect(
      ExecutionFactTargetSchema.safeParse({ scope: "national", countryCode: "US" }).success,
    ).toBe(false);
    expect(
      ExecutionFactTargetSchema.safeParse({ scope: "scene", sceneKey: "shopping_feed" }).success,
    ).toBe(false);
  });

  it("keeps the legacy POI fact contract intact", () => {
    const legacy = PoiFactSchema.parse({ ...reviewedFact, target: undefined, poiId: "poi-1" });
    expect(legacy.poiId).toBe("poi-1");
    expect("target" in legacy).toBe(false);
  });

  it("applies the same lifecycle eligibility to every target scope", () => {
    const targets: ExecutionFactTarget[] = [
      { scope: "poi", poiId: "poi-1" },
      { scope: "city", city: "shanghai" },
      { scope: "scene", sceneKey: "payment" },
      { scope: "national", countryCode: "CN" },
    ];

    for (const target of targets) {
      const parsed = ScopedExecutionFactSchema.parse({ ...reviewedFact, target });
      expect(isEligibleScopedExecutionFact(parsed, new Date("2026-08-25T00:00:00.000Z"))).toBe(
        true,
      );
      expect(isEligibleScopedExecutionFact(parsed, new Date("2026-09-20T00:00:00.000Z"))).toBe(
        false,
      );
    }
  });

  it("derives deterministic POI to city to scene to national retrieval order", () => {
    const targets = deriveExecutionFactTargetOrder({
      poiId: "poi-1",
      city: "  ShangHai  ",
      sceneKey: "payment",
    });

    expect(targets).toEqual([
      { scope: "poi", poiId: "poi-1" },
      { scope: "city", city: "shanghai" },
      { scope: "scene", sceneKey: "payment" },
      { scope: "national", countryCode: "CN" },
    ]);
    expect(targets.map(executionFactTargetKey)).toEqual([
      "poi:poi-1",
      "city:shanghai",
      "scene:payment",
      "national:CN",
    ]);
  });

  it("returns an explicit non-overwrite version conflict", () => {
    expect(resolveExecutionFactVersion({ expectedVersion: 2, currentVersion: 3 })).toEqual({
      status: "conflict",
      expectedVersion: 2,
      currentVersion: 3,
      reason: "stale_version",
    });
    expect(resolveExecutionFactVersion({ expectedVersion: 2, currentVersion: null })).toEqual({
      status: "conflict",
      expectedVersion: 2,
      currentVersion: null,
      reason: "target_missing",
    });
    expect(resolveExecutionFactVersion({ expectedVersion: 2, currentVersion: 2 }).status).toBe(
      "current",
    );
  });
});
