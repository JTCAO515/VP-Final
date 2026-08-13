import { z } from "zod";
import { PoiSchema, isEligiblePoiFact, type Poi, type PoiFact } from "../knowledge/index.js";
import { SeoPageIntentSchema, type SeoPageIntent } from "./intents.js";

export { SeoPageIntentSchema } from "./intents.js";
export type { SeoPageIntent } from "./intents.js";

export const SeoPageCandidateSchema = z
  .object({
    poiId: z.string().min(1),
    citySlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    poiSlug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    intent: SeoPageIntentSchema,
    canonicalPath: z.string().regex(/^\/[a-z0-9-]+\/[a-z0-9-]+\/[a-z0-9-]+$/),
    title: z.string().trim().min(1).max(140),
    summary: z.string().trim().min(1).max(240),
    supportingFactIds: z.array(z.string().min(1)).min(1).max(4),
    lastVerifiedAt: z.string().datetime(),
  })
  .strict();

export const SeoPageGapSchema = z
  .object({
    poiId: z.string().min(1),
    intent: SeoPageIntentSchema,
    reason: z.literal("insufficient_current_reviewed_facts"),
  })
  .strict();

export const SeoPageMatrixSchema = z
  .object({
    pages: z.array(SeoPageCandidateSchema),
    gaps: z.array(SeoPageGapSchema),
  })
  .strict()
  .superRefine((matrix, context) => {
    const paths = matrix.pages.map((page) => page.canonicalPath);
    if (new Set(paths).size !== paths.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["pages"],
        message: "SEO matrix canonical paths must be unique",
      });
    }
  });

export type SeoPageCandidate = z.infer<typeof SeoPageCandidateSchema>;
export type SeoPageGap = z.infer<typeof SeoPageGapSchema>;
export type SeoPageMatrix = z.infer<typeof SeoPageMatrixSchema>;

type IntentRule = Readonly<{
  intent: SeoPageIntent;
  match: "any" | "all";
  requiredFactTypes: readonly string[];
  titleSuffix: string;
  summary: (poi: Poi) => string;
}>;

const INTENT_RULES: readonly IntentRule[] = [
  {
    intent: "payment",
    match: "any",
    requiredFactTypes: ["payment_acceptance"],
    titleSuffix: "payment guide",
    summary: (poi) => `Current reviewed payment information for ${poi.nameEn} in ${poi.city}.`,
  },
  {
    intent: "transport",
    match: "any",
    requiredFactTypes: ["metro_access"],
    titleSuffix: "transport guide",
    summary: (poi) => `Current reviewed transport information for ${poi.nameEn} in ${poi.city}.`,
  },
  {
    intent: "ticket",
    match: "any",
    requiredFactTypes: ["booking_required", "ticket_availability", "reservation_helpful"],
    titleSuffix: "ticket and reservation guide",
    summary: (poi) =>
      `Current reviewed ticket or reservation information for ${poi.nameEn} in ${poi.city}.`,
  },
  {
    intent: "first_timer",
    match: "all",
    requiredFactTypes: ["booking_required", "metro_access"],
    titleSuffix: "first-time visitor guide",
    summary: (poi) =>
      `Current reviewed first-time visitor information for ${poi.nameEn} in ${poi.city}.`,
  },
  {
    intent: "rainy_day",
    match: "any",
    requiredFactTypes: ["rainy_fit"],
    titleSuffix: "rainy-day guide",
    summary: (poi) => `Current reviewed rainy-day information for ${poi.nameEn} in ${poi.city}.`,
  },
];

/**
 * Creates only evidence-backed candidates for later public page consumers. The matrix is not a
 * content generator: it records the exact reviewed facts that support each intent and emits a
 * structured gap when that support is absent.
 */
export function deriveSeoPageMatrix(
  input: readonly z.input<typeof PoiSchema>[],
  now = new Date(),
): SeoPageMatrix {
  const pages: SeoPageCandidate[] = [];
  const gaps: SeoPageGap[] = [];

  for (const rawPoi of input) {
    const poi = PoiSchema.parse(rawPoi);
    const facts = poi.facts.filter((fact) => isEligiblePoiFact(fact, now));

    for (const rule of INTENT_RULES) {
      const supportingFacts = selectSupportingFacts(facts, rule);
      if (supportingFacts.length === 0) {
        gaps.push({
          poiId: poi.id,
          intent: rule.intent,
          reason: "insufficient_current_reviewed_facts",
        });
        continue;
      }

      const citySlug = slugify(poi.city);
      const poiSlug = slugify(poi.nameEn);
      const supportingFactIds = supportingFacts.map((fact) => fact.id);
      pages.push({
        poiId: poi.id,
        citySlug,
        poiSlug,
        intent: rule.intent,
        canonicalPath: `/${citySlug}/${poiSlug}/${rule.intent.replaceAll("_", "-")}`,
        title: `${poi.nameEn} ${rule.titleSuffix}`,
        summary: rule.summary(poi),
        supportingFactIds,
        lastVerifiedAt: latestVerification(supportingFacts),
      });
    }
  }

  return SeoPageMatrixSchema.parse({ pages, gaps });
}

function selectSupportingFacts(facts: readonly PoiFact[], rule: IntentRule): PoiFact[] {
  const selected = facts.filter((fact) => rule.requiredFactTypes.includes(fact.factType));
  const unique = new Map(selected.map((fact) => [fact.id, fact]));
  const result = [...unique.values()]
    .sort((left, right) => left.id.localeCompare(right.id))
    .slice(0, 4);
  if (rule.match === "all") {
    const presentFactTypes = new Set(result.map((fact) => fact.factType));
    if (!rule.requiredFactTypes.every((factType) => presentFactTypes.has(factType))) return [];
  }
  return result;
}

function latestVerification(facts: readonly PoiFact[]): string {
  const verifiedAt = facts
    .map((fact) => fact.verifiedAt)
    .filter((value): value is string => value !== null)
    .sort();
  const latest = verifiedAt.at(-1);
  if (!latest) throw new Error("Eligible SEO facts must have a verification timestamp");
  return latest;
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
  if (!slug) throw new Error("SEO city and POI names require a canonical Latin slug");
  return slug;
}
