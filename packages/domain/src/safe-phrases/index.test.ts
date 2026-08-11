import { describe, expect, it } from "vitest";

import {
  SafePhraseSchema,
  isEligibleSafePhrase,
  resolveEligibleSafePhrase,
  type SafePhrase,
} from "./index.js";

const verifiedPhrase: SafePhrase = {
  id: "34900000-0000-4000-8000-000000000001",
  category: "allergy_dietary",
  scene: "restaurant",
  intentKey: "peanut-allergy",
  variantKey: "full",
  severity: "severe",
  chineseExpression: "[operator-curated-expression]",
  englishIntent: "Communicate a severe peanut allergy to restaurant staff.",
  sourceClass: "operator_verified",
  sourceLocator: "ops://safe-phrases/allergy/peanut-allergy/full/severe",
  evidenceSummary: "An approved bilingual safety reviewer verified this fixed expression.",
  verifiedBy: "34900000-0000-4000-8000-000000000002",
  verifiedAt: "2026-08-01T00:00:00.000Z",
  expiresAt: "2026-10-30T00:00:00.000Z",
  reviewPolicy: "operator-verified-90d-v1",
  status: "reviewed",
  createdAt: "2026-08-01T00:00:00.000Z",
};

describe("SafePhraseSchema", () => {
  it("accepts a reviewed operator-verified fixed expression", () => {
    expect(SafePhraseSchema.safeParse(verifiedPhrase).success).toBe(true);
  });

  it("rejects a reviewed expression without an operator verification record", () => {
    expect(
      SafePhraseSchema.safeParse({
        ...verifiedPhrase,
        verifiedBy: null,
      }).success,
    ).toBe(false);
  });

  it("rejects a reviewed expression with a review interval over 90 days", () => {
    expect(
      SafePhraseSchema.safeParse({
        ...verifiedPhrase,
        expiresAt: "2026-10-31T00:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});

describe("isEligibleSafePhrase", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");

  it("permits only currently reviewed operator expressions", () => {
    expect(isEligibleSafePhrase(verifiedPhrase, now)).toBe(true);
    expect(isEligibleSafePhrase({ ...verifiedPhrase, status: "draft" }, now)).toBe(false);
    expect(isEligibleSafePhrase({ ...verifiedPhrase, verifiedAt: null }, now)).toBe(false);
  });

  it("does not permit an expired expression", () => {
    expect(
      isEligibleSafePhrase({ ...verifiedPhrase, expiresAt: "2026-08-10T23:59:59.000Z" }, now),
    ).toBe(false);
  });
});

describe("resolveEligibleSafePhrase", () => {
  const now = new Date("2026-08-11T00:00:00.000Z");

  it("requires an exact severity match and never substitutes a standard variant", () => {
    const standard = { ...verifiedPhrase, severity: "standard" as const };

    expect(
      resolveEligibleSafePhrase(
        [standard],
        {
          category: "allergy_dietary",
          scene: "restaurant",
          intentKey: "peanut-allergy",
          variantKey: "full",
          severity: "severe",
        },
        now,
      ),
    ).toBeNull();
    expect(
      resolveEligibleSafePhrase(
        [verifiedPhrase],
        {
          category: "allergy_dietary",
          scene: "restaurant",
          intentKey: "peanut-allergy",
          variantKey: "full",
          severity: "severe",
        },
        now,
      ),
    ).toEqual(verifiedPhrase);
  });

  it("fails closed when two eligible records match the same selection", () => {
    expect(
      resolveEligibleSafePhrase(
        [verifiedPhrase, { ...verifiedPhrase, id: "34900000-0000-4000-8000-000000000003" }],
        {
          category: "allergy_dietary",
          scene: "restaurant",
          intentKey: "peanut-allergy",
          variantKey: "full",
          severity: "severe",
        },
        now,
      ),
    ).toBeNull();
  });
});
