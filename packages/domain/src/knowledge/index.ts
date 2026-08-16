import { z } from "zod";

export const PoiCategorySchema = z.enum(["food", "attraction", "hotel", "shopping", "experience"]);

export const PoiFactStatusSchema = z.enum([
  "draft",
  "reviewed",
  "deprecated",
  "rejected",
  // Read-only compatibility for facts written before ADR-0006. It is never eligible for consumers.
  "active",
]);

export const PoiFactSourceClassSchema = z.enum([
  "official",
  "operator_verified",
  "reputable_editorial",
  "user_report",
  "model_output",
  "uncorroborated_scrape",
]);

export const PoiFactSourceLocatorSchema = z.string().trim().min(1).max(500);

export const PoiFactEvidenceSummarySchema = z
  .string()
  .trim()
  .min(1)
  .max(240)
  .refine((value) => !/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(value), {
    message: "Evidence summary must not contain an email address",
  })
  .refine((value) => !/\b(?:\+?\d[\d\s()-]{6,}\d)\b/.test(value), {
    message: "Evidence summary must not contain a phone number",
  });

export const PoiFactEvidenceSchema = z.object({
  sourceClass: PoiFactSourceClassSchema,
  sourceLocator: PoiFactSourceLocatorSchema,
  evidenceSummary: PoiFactEvidenceSummarySchema,
});

export const PoiFactReviewPolicySchema = z.enum([
  "volatile-30d-v1",
  "execution-90d-v1",
  "stable-180d-v1",
]);

// These facts are deliberately separate rows so every value shown to a local person has
// independent evidence, review, and expiry metadata. Legacy POI strings are not evidence.
export const PoiLocalPresentationFactTypeSchema = z.enum([
  "local_name_zh",
  "local_address_zh",
  "local_address_district",
  "local_address_nearest_metro_exit",
  "local_address_visibility_note",
]);

export const PoiLocalPresentationFactValueSchema = z.object({
  text: z.string().trim().min(1).max(500),
});

const REVIEW_POLICY_DAYS = {
  "volatile-30d-v1": 30,
  "execution-90d-v1": 90,
  "stable-180d-v1": 180,
} as const;

const VOLATILE_FACT_TYPES = new Set([
  "booking_required",
  "hours",
  "payment_acceptance",
  "reservation_helpful",
  "ticket_availability",
]);

const STABLE_FACT_TYPES = new Set(["rainy_fit"]);

export const PoiFactSchema = z.object({
  id: z.string().min(1),
  poiId: z.string().min(1),
  factType: z.string().min(1),
  value: z.record(z.unknown()),
  confidence: z.number().min(0).max(1),
  // Compatibility projection for pre-evidence-contract consumers. New writes mirror sourceLocator.
  source: z.string().min(1),
  sourceClass: PoiFactSourceClassSchema.nullable().default(null),
  sourceLocator: PoiFactSourceLocatorSchema.nullable().default(null),
  evidenceSummary: PoiFactEvidenceSummarySchema.nullable().default(null),
  ingestedAt: z.string().datetime(),
  verifiedAt: z.string().datetime().nullable().default(null),
  expiresAt: z.string().datetime().nullable().default(null),
  reviewPolicy: PoiFactReviewPolicySchema.nullable().default(null),
  version: z.number().int().positive(),
  status: PoiFactStatusSchema.default("draft"),
});

export const PoiLocalPresentationFactSchema = PoiFactSchema.extend({
  factType: PoiLocalPresentationFactTypeSchema,
  value: PoiLocalPresentationFactValueSchema,
});

export const EligiblePoiLocalAddressSchema = z.object({
  addressZh: z.string().trim().min(1).max(500),
  nameZh: z.string().trim().min(1).max(500).optional(),
  district: z.string().trim().min(1).max(500).optional(),
  nearestMetroExit: z.string().trim().min(1).max(500).optional(),
  visibilityNote: z.string().trim().min(1).max(500).optional(),
});

const RequestHumanHelpAlternativeSchema = z.object({
  kind: z.literal("request_human_help"),
  label: z.literal("Request Human Help"),
});

const EnterAddressManuallyAlternativeSchema = z.object({
  kind: z.literal("enter_address_manually"),
  label: z.literal("Enter the address yourself"),
});

const ShowEnglishNameAlternativeSchema = z.object({
  kind: z.literal("show_english_name"),
  label: z.literal("Show the English name for local confirmation"),
  value: z.string().trim().min(1),
});

export const PoiLocalAddressAlternativeSchema = z.discriminatedUnion("kind", [
  RequestHumanHelpAlternativeSchema,
  EnterAddressManuallyAlternativeSchema,
  ShowEnglishNameAlternativeSchema,
]);

export const PoiLocalAddressPresentationSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ready"),
    localAddress: EligiblePoiLocalAddressSchema,
  }),
  z.object({
    status: z.literal("unavailable"),
    message: z.literal("We do not have one current verified Chinese address for this place."),
    alternatives: z.tuple([
      RequestHumanHelpAlternativeSchema,
      EnterAddressManuallyAlternativeSchema,
      ShowEnglishNameAlternativeSchema,
    ]),
  }),
]);

export const PoiCommercialLinkSchema = z.object({
  id: z.string().min(1),
  poiId: z.string().min(1),
  partner: z.string().min(1),
  url: z.string().url(),
  disclosure: z.string().min(1),
});

export const PoiSearchAliasSchema = z.string().trim().min(1).max(100);

export const PoiSchema = z.object({
  id: z.string().min(1),
  city: z.string().min(1),
  category: PoiCategorySchema,
  nameEn: z.string().min(1),
  nameZh: z.string().optional(),
  address: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  sourceIds: z.record(z.unknown()).default({}),
  // Search aliases are lexical lookup metadata only. They are not factual evidence and cannot
  // make a POI fact eligible for retrieval or local-facing presentation.
  searchAliases: z.array(PoiSearchAliasSchema).optional(),
  facts: z.array(PoiFactSchema).default([]),
  commercialLinks: z.array(PoiCommercialLinkSchema).default([]),
});

const PoiCitySchema = z.string().trim().min(1).max(100);
const PoiNameSchema = z.string().trim().min(1).max(200);
const PoiOptionalNameSchema = z.string().trim().min(1).max(200).nullable().default(null);
const PoiLatitudeSchema = z.number().finite().min(-90).max(90).nullable().default(null);
const PoiLongitudeSchema = z.number().finite().min(-180).max(180).nullable().default(null);

const PoiWritableFieldsObjectSchema = z
  .object({
    city: PoiCitySchema,
    category: PoiCategorySchema,
    nameEn: PoiNameSchema,
    nameZh: PoiOptionalNameSchema,
    latitude: PoiLatitudeSchema,
    longitude: PoiLongitudeSchema,
  })
  .strict();

// Canonical POI fields are edited as a complete set. Coordinates are intentionally all-or-nothing:
// accepting a single axis would create a location that downstream consumers could misinterpret.
function requireCoordinatePair(
  value: { latitude: number | null; longitude: number | null },
  context: z.RefinementCtx,
) {
  if ((value.latitude === null) !== (value.longitude === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Latitude and longitude must be provided together",
      path: ["latitude"],
    });
  }
}

export const PoiCreateInputSchema =
  PoiWritableFieldsObjectSchema.superRefine(requireCoordinatePair);
export const PoiUpdateInputSchema = PoiWritableFieldsObjectSchema.extend({
  id: z.string().uuid(),
}).superRefine(requireCoordinatePair);

export const KnowledgeGapSchema = z.object({
  id: z.string().min(1),
  questionPattern: z.string().min(1),
  frequency: z.number().int().positive(),
  city: z.string().optional(),
  status: z.enum(["open", "resolved", "ignored"]),
  resolvedAt: z.string().datetime().optional(),
  resolutionTarget: z
    .object({
      kind: z.enum(["poi_fact", "guide"]),
      id: z.string().min(1),
    })
    .optional(),
});

export type PoiCategory = z.infer<typeof PoiCategorySchema>;
export type PoiFactStatus = z.infer<typeof PoiFactStatusSchema>;
export type PoiFactSourceClass = z.infer<typeof PoiFactSourceClassSchema>;
export type PoiFactReviewPolicy = z.infer<typeof PoiFactReviewPolicySchema>;
export type PoiFact = z.infer<typeof PoiFactSchema>;
export type PoiLocalPresentationFactType = z.infer<typeof PoiLocalPresentationFactTypeSchema>;
export type PoiLocalPresentationFact = z.infer<typeof PoiLocalPresentationFactSchema>;
export type EligiblePoiLocalAddress = z.infer<typeof EligiblePoiLocalAddressSchema>;
export type PoiLocalAddressAlternative = z.infer<typeof PoiLocalAddressAlternativeSchema>;
export type PoiLocalAddressPresentation = z.infer<typeof PoiLocalAddressPresentationSchema>;
export type Poi = z.infer<typeof PoiSchema>;
export type PoiCreateInput = z.infer<typeof PoiCreateInputSchema>;
export type PoiUpdateInput = z.infer<typeof PoiUpdateInputSchema>;
export type KnowledgeGap = z.infer<typeof KnowledgeGapSchema>;

export const TRAVELER_SCENE_TAGS = [
  "First time in China",
  "Low Mandarin",
  "Good in rain",
  "Near metro",
  "Avoid peak hours",
] as const;

export type TravelerSceneTag = (typeof TRAVELER_SCENE_TAGS)[number];

export function isEligiblePoiFact(fact: PoiFact, now = new Date()): boolean {
  return (
    fact.status === "reviewed" &&
    hasReviewablePoiFactEvidence(fact) &&
    fact.verifiedAt !== null &&
    hasValidPoiFactReview(fact) &&
    fact.expiresAt !== null &&
    Number.isFinite(Date.parse(fact.verifiedAt)) &&
    Date.parse(fact.verifiedAt) <= now.getTime() &&
    Date.parse(fact.expiresAt) >= now.getTime()
  );
}

export function hasValidPoiFactReview(
  fact: Pick<PoiFact, "factType" | "reviewPolicy" | "verifiedAt" | "expiresAt">,
): boolean {
  if (
    fact.reviewPolicy === null ||
    fact.verifiedAt === null ||
    fact.expiresAt === null ||
    fact.reviewPolicy !== reviewPolicyForFactType(fact.factType)
  ) {
    return false;
  }
  const verifiedAt = new Date(fact.verifiedAt);
  try {
    const review = resolvePoiFactReview({
      factType: fact.factType,
      verifiedAt,
      requestedExpiresAt: fact.expiresAt,
    });
    return Date.parse(review.expiresAt) === Date.parse(fact.expiresAt);
  } catch {
    return false;
  }
}

export function reviewPolicyForFactType(factType: string): PoiFactReviewPolicy {
  if (VOLATILE_FACT_TYPES.has(factType)) return "volatile-30d-v1";
  if (STABLE_FACT_TYPES.has(factType)) return "stable-180d-v1";
  return "execution-90d-v1";
}

export function resolvePoiFactReview(input: {
  factType: string;
  verifiedAt: Date;
  requestedExpiresAt?: string | null;
}): { reviewPolicy: PoiFactReviewPolicy; expiresAt: string } {
  const reviewPolicy = reviewPolicyForFactType(input.factType);
  const maximum = new Date(input.verifiedAt);
  maximum.setUTCDate(maximum.getUTCDate() + REVIEW_POLICY_DAYS[reviewPolicy]);

  if (input.requestedExpiresAt === undefined || input.requestedExpiresAt === null) {
    return { reviewPolicy, expiresAt: maximum.toISOString() };
  }

  const requested = new Date(input.requestedExpiresAt);
  if (!Number.isFinite(requested.getTime()) || requested <= input.verifiedAt) {
    throw new Error("Review expiry must be later than the verification time");
  }
  if (requested > maximum) {
    throw new Error(`Review expiry exceeds ${reviewPolicy} maximum`);
  }
  return { reviewPolicy, expiresAt: requested.toISOString() };
}

export function hasReviewablePoiFactEvidence(
  fact: Pick<PoiFact, "sourceClass" | "sourceLocator" | "evidenceSummary">,
): boolean {
  if (
    fact.sourceClass !== "official" &&
    fact.sourceClass !== "operator_verified" &&
    fact.sourceClass !== "reputable_editorial"
  ) {
    return false;
  }
  return PoiFactEvidenceSchema.safeParse(fact).success;
}

// Kept for existing callers. "Current" now means eligible under ADR-0006, not merely non-expired.
export const isCurrentPoiFact = isEligiblePoiFact;

export function deriveEligiblePoiLocalAddress(
  poi: Pick<Poi, "facts">,
  now = new Date(),
): EligiblePoiLocalAddress | null {
  const valuesByType = new Map<PoiLocalPresentationFactType, string[]>();

  for (const fact of poi.facts) {
    const parsed = PoiLocalPresentationFactSchema.safeParse(fact);
    if (!parsed.success || !isEligiblePoiFact(parsed.data, now)) continue;
    const values = valuesByType.get(parsed.data.factType) ?? [];
    values.push(parsed.data.value.text);
    valuesByType.set(parsed.data.factType, values);
  }

  const addressZh = exactlyOne(valuesByType.get("local_address_zh"));
  if (!addressZh) return null;
  const nameZh = optionalExactlyOne(valuesByType.get("local_name_zh"));
  const district = optionalExactlyOne(valuesByType.get("local_address_district"));
  const nearestMetroExit = optionalExactlyOne(valuesByType.get("local_address_nearest_metro_exit"));
  const visibilityNote = optionalExactlyOne(valuesByType.get("local_address_visibility_note"));

  return EligiblePoiLocalAddressSchema.parse({
    addressZh,
    ...(nameZh ? { nameZh } : {}),
    ...(district ? { district } : {}),
    ...(nearestMetroExit ? { nearestMetroExit } : {}),
    ...(visibilityNote ? { visibilityNote } : {}),
  });
}

// Every Show-to-Local, copy, speech, or address-card consumer must start from this decision.
// Legacy POI strings and model output are deliberately absent from the unavailable branch.
export function resolvePoiLocalAddressPresentation(
  poi: Pick<Poi, "facts" | "nameEn">,
  now = new Date(),
): PoiLocalAddressPresentation {
  const localAddress = deriveEligiblePoiLocalAddress(poi, now);
  if (localAddress) {
    return PoiLocalAddressPresentationSchema.parse({ status: "ready", localAddress });
  }

  return PoiLocalAddressPresentationSchema.parse({
    status: "unavailable",
    message: "We do not have one current verified Chinese address for this place.",
    alternatives: [
      { kind: "request_human_help", label: "Request Human Help" },
      { kind: "enter_address_manually", label: "Enter the address yourself" },
      {
        kind: "show_english_name",
        label: "Show the English name for local confirmation",
        value: poi.nameEn,
      },
    ],
  });
}

export function updatePoiFact(
  pois: Poi[],
  factId: string,
  value: Record<string, unknown>,
  fields: Partial<
    Pick<
      PoiFact,
      | "confidence"
      | "source"
      | "sourceClass"
      | "sourceLocator"
      | "evidenceSummary"
      | "expiresAt"
      | "status"
      | "verifiedAt"
      | "reviewPolicy"
    >
  > = {},
): Poi[] {
  return pois.map((poi) => ({
    ...poi,
    facts: poi.facts.map((fact) =>
      fact.id === factId
        ? {
            ...fact,
            ...fields,
            value,
            version: fact.version + 1,
          }
        : fact,
    ),
  }));
}

function exactlyOne(values: string[] | undefined): string | null {
  return values?.length === 1 ? (values[0] ?? null) : null;
}

function optionalExactlyOne(values: string[] | undefined): string | undefined {
  return values?.length === 1 ? values[0] : undefined;
}

export function derivePoiSceneTags(poi: Poi, now = new Date()): TravelerSceneTag[] {
  const tags = new Set<TravelerSceneTag>();

  for (const fact of poi.facts) {
    if (!isCurrentPoiFact(fact, now)) continue;
    if (fact.factType === "metro_access") tags.add("Near metro");
    if (fact.factType === "english_menu") tags.add("Low Mandarin");
    if (fact.factType === "rainy_fit") tags.add("Good in rain");
    if (fact.factType === "booking_required") tags.add("First time in China");
    if (fact.factType === "reservation_helpful") tags.add("Avoid peak hours");
  }

  return [...tags];
}
