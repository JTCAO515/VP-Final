import { describe, expect, it } from "vitest";
import {
  PoiFactEvidenceSummarySchema,
  PoiCreateInputSchema,
  PoiLocalPresentationFactValueSchema,
  PoiLocalPresentationFactSchema,
  PoiSchema,
  PoiUpdateInputSchema,
  deriveEligiblePoiLocalAddress,
  derivePoiSceneTags,
  isEligiblePoiFact,
  isCurrentPoiFact,
  resolvePoiLocalAddressPresentation,
  resolvePoiFactReview,
  reviewPolicyForFactType,
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
  expiresAt: "2026-09-29T00:00:00.000Z",
  reviewPolicy: "execution-90d-v1",
  version: 1,
  status: "reviewed",
};

function localFact(
  factType:
    | "local_name_zh"
    | "local_address_zh"
    | "local_address_district"
    | "local_address_nearest_metro_exit"
    | "local_address_visibility_note",
  text: string,
  overrides: Partial<PoiFact> = {},
): PoiFact {
  return PoiLocalPresentationFactSchema.parse({
    ...fact,
    id: `fact-${factType}-${text}`,
    factType,
    value: { text },
    ...overrides,
  });
}

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
    expect(poi.searchAliases).toBeUndefined();
  });

  it("accepts bounded lexical search aliases without treating them as facts", () => {
    expect(
      PoiSchema.parse({
        id: "poi-alias",
        city: "Shanghai",
        category: "attraction",
        nameEn: "Alias POI",
        searchAliases: ["Alias Place"],
      }).searchAliases,
    ).toEqual(["Alias Place"]);
  });
});

describe("canonical POI write inputs", () => {
  const fields = {
    city: "Shanghai",
    category: "attraction" as const,
    nameEn: "Yu Garden",
    nameZh: "豫园",
    latitude: 31.227,
    longitude: 121.492,
  };

  it("accepts a complete canonical POI record", () => {
    expect(PoiCreateInputSchema.parse(fields)).toEqual(fields);
    expect(
      PoiUpdateInputSchema.parse({ id: "30000000-0000-4000-8000-000000000001", ...fields }),
    ).toMatchObject(fields);
  });

  it("requires coordinates to be present or absent together", () => {
    expect(() => PoiCreateInputSchema.parse({ ...fields, longitude: null })).toThrow(
      "Latitude and longitude must be provided together",
    );
    expect(
      PoiCreateInputSchema.parse({ ...fields, latitude: null, longitude: null }),
    ).toMatchObject({
      latitude: null,
      longitude: null,
    });
  });

  it("rejects invalid coordinates and empty canonical names", () => {
    expect(() => PoiCreateInputSchema.parse({ ...fields, latitude: 91 })).toThrow();
    expect(() => PoiCreateInputSchema.parse({ ...fields, nameEn: " " })).toThrow();
  });
});

describe("local-presentation fact values", () => {
  it("accepts only a bounded text value", () => {
    expect(PoiLocalPresentationFactValueSchema.parse({ text: "豫园" })).toEqual({ text: "豫园" });
    expect(() => PoiLocalPresentationFactValueSchema.parse({ label: "豫园" })).toThrow();
    expect(() => PoiLocalPresentationFactValueSchema.parse({ text: "x".repeat(501) })).toThrow();
  });
});

describe("deriveEligiblePoiLocalAddress", () => {
  const now = new Date("2026-07-09T00:00:00.000Z");

  it("uses independently eligible facts and leaves missing components absent", () => {
    const address = deriveEligiblePoiLocalAddress(
      {
        facts: [
          localFact("local_address_zh", "上海市黄浦区豫园路279号"),
          localFact("local_name_zh", "豫园"),
          localFact("local_address_district", "黄浦区"),
        ],
      },
      now,
    );

    expect(address).toEqual({
      addressZh: "上海市黄浦区豫园路279号",
      nameZh: "豫园",
      district: "黄浦区",
    });
  });

  it("never promotes legacy POI strings or draft facts into a local address", () => {
    const legacyOnly = PoiSchema.parse({
      id: "legacy-poi",
      city: "Shanghai",
      category: "attraction",
      nameEn: "Yu Garden",
      nameZh: "豫园",
      address: "279 Yuyuan Old St",
    });

    expect(legacyOnly.nameZh).toBe("豫园");
    expect(legacyOnly.address).toBe("279 Yuyuan Old St");
    expect(deriveEligiblePoiLocalAddress(legacyOnly, now)).toBeNull();
    expect(
      deriveEligiblePoiLocalAddress(
        {
          facts: [
            localFact("local_address_zh", "上海市黄浦区豫园路279号", {
              status: "draft",
              verifiedAt: null,
              expiresAt: null,
              reviewPolicy: null,
            }),
          ],
        },
        now,
      ),
    ).toBeNull();
  });

  it("fails closed for expired or ambiguous address facts", () => {
    expect(
      deriveEligiblePoiLocalAddress(
        {
          facts: [
            localFact("local_address_zh", "上海市黄浦区豫园路279号", {
              expiresAt: "2026-07-08T00:00:00.000Z",
            }),
          ],
        },
        now,
      ),
    ).toBeNull();
    expect(
      deriveEligiblePoiLocalAddress(
        {
          facts: [
            localFact("local_address_zh", "上海市黄浦区豫园路279号"),
            localFact("local_address_zh", "上海市黄浦区安仁街137号"),
          ],
        },
        now,
      ),
    ).toBeNull();
  });
});

describe("resolvePoiLocalAddressPresentation", () => {
  const now = new Date("2026-07-09T00:00:00.000Z");

  function poiWithFacts(facts: PoiFact[]): Poi {
    return PoiSchema.parse({
      id: "poi-local-address",
      city: "Shanghai",
      category: "attraction",
      nameEn: "Yu Garden",
      nameZh: "legacy-name-must-not-display",
      address: "legacy-address-must-not-display",
      facts,
    });
  }

  it("returns only a currently eligible local address for presentation", () => {
    expect(
      resolvePoiLocalAddressPresentation(
        poiWithFacts([
          localFact("local_address_zh", "上海市黄浦区豫园路279号"),
          localFact("local_name_zh", "豫园"),
        ]),
        now,
      ),
    ).toEqual({
      status: "ready",
      localAddress: {
        addressZh: "上海市黄浦区豫园路279号",
        nameZh: "豫园",
      },
    });
  });

  it("keeps a verified address usable until its actual expiry without a 30-day early downgrade", () => {
    expect(
      resolvePoiLocalAddressPresentation(
        poiWithFacts([
          localFact("local_address_zh", "上海市黄浦区豫园路279号", {
            expiresAt: "2026-07-20T00:00:00.000Z",
          }),
        ]),
        now,
      ).status,
    ).toBe("ready");
  });

  it.each([
    [
      "draft",
      localFact("local_address_zh", "draft-address", {
        status: "draft",
        verifiedAt: null,
        expiresAt: null,
        reviewPolicy: null,
      }),
    ],
    [
      "expired",
      localFact("local_address_zh", "expired-address", {
        expiresAt: "2026-07-08T23:59:59.000Z",
      }),
    ],
    [
      "model output",
      localFact("local_address_zh", "model-address", {
        sourceClass: "model_output",
      }),
    ],
  ])("returns the same honest unavailable decision for a %s address", (_label, addressFact) => {
    expect(resolvePoiLocalAddressPresentation(poiWithFacts([addressFact]), now)).toEqual({
      status: "unavailable",
      message: "We do not have one current verified Chinese address for this place.",
      alternatives: [
        { kind: "request_human_help", label: "Request Human Help" },
        { kind: "enter_address_manually", label: "Enter the address yourself" },
        {
          kind: "show_english_name",
          label: "Show the English name for local confirmation",
          value: "Yu Garden",
        },
      ],
    });
  });

  it("never falls back to legacy, ambiguous, or model-authored address values", () => {
    const decision = resolvePoiLocalAddressPresentation(
      poiWithFacts([
        localFact("local_address_zh", "first-reviewed-address"),
        localFact("local_address_zh", "second-reviewed-address"),
        localFact("local_address_zh", "model-address", { sourceClass: "model_output" }),
      ]),
      now,
    );
    const serialized = JSON.stringify(decision);

    expect(decision.status).toBe("unavailable");
    expect(serialized).not.toContain("legacy-address-must-not-display");
    expect(serialized).not.toContain("legacy-name-must-not-display");
    expect(serialized).not.toContain("first-reviewed-address");
    expect(serialized).not.toContain("second-reviewed-address");
    expect(serialized).not.toContain("model-address");
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
    expect(isEligiblePoiFact({ ...fact, expiresAt: null })).toBe(false);
    expect(isEligiblePoiFact({ ...fact, reviewPolicy: null })).toBe(false);
    expect(isEligiblePoiFact({ ...fact, reviewPolicy: "stable-180d-v1" })).toBe(false);
    expect(isEligiblePoiFact({ ...fact, expiresAt: "2027-01-01T00:00:00.000Z" })).toBe(false);
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

describe("POI fact review policy", () => {
  it("assigns volatile, stable, and conservative default policies", () => {
    expect(reviewPolicyForFactType("payment_acceptance")).toBe("volatile-30d-v1");
    expect(reviewPolicyForFactType("rainy_fit")).toBe("stable-180d-v1");
    expect(reviewPolicyForFactType("new_unclassified_fact")).toBe("execution-90d-v1");
  });

  it("derives the maximum expiry when none is requested", () => {
    expect(
      resolvePoiFactReview({
        factType: "payment_acceptance",
        verifiedAt: new Date("2026-07-01T00:00:00.000Z"),
      }),
    ).toEqual({
      reviewPolicy: "volatile-30d-v1",
      expiresAt: "2026-07-31T00:00:00.000Z",
    });
  });

  it("accepts an earlier expiry and rejects policy extensions", () => {
    const verifiedAt = new Date("2026-07-01T00:00:00.000Z");
    expect(
      resolvePoiFactReview({
        factType: "metro_access",
        verifiedAt,
        requestedExpiresAt: "2026-08-01T00:00:00.000Z",
      }).expiresAt,
    ).toBe("2026-08-01T00:00:00.000Z");
    expect(() =>
      resolvePoiFactReview({
        factType: "metro_access",
        verifiedAt,
        requestedExpiresAt: "2027-01-01T00:00:00.000Z",
      }),
    ).toThrow("execution-90d-v1");
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
