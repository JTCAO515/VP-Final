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
  version: z.number().int().positive(),
  status: PoiFactStatusSchema.default("draft"),
});

export const PoiCommercialLinkSchema = z.object({
  id: z.string().min(1),
  poiId: z.string().min(1),
  partner: z.string().min(1),
  url: z.string().url(),
  disclosure: z.string().min(1),
});

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
  facts: z.array(PoiFactSchema).default([]),
  commercialLinks: z.array(PoiCommercialLinkSchema).default([]),
});

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
export type PoiFact = z.infer<typeof PoiFactSchema>;
export type Poi = z.infer<typeof PoiSchema>;
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
    Number.isFinite(Date.parse(fact.verifiedAt)) &&
    Date.parse(fact.verifiedAt) <= now.getTime() &&
    (!fact.expiresAt || Date.parse(fact.expiresAt) >= now.getTime())
  );
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
