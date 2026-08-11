import { z } from "zod";

import { PoiFactEvidenceSummarySchema, PoiFactSourceLocatorSchema } from "../knowledge/index.js";

// These categories are intentionally closed. A new high-risk expression class requires
// its own safety review instead of silently inheriting this lookup path.
export const SafePhraseCategorySchema = z.enum([
  "allergy_dietary",
  "symptoms_medical",
  "emergency_help",
  "passport_visa_ticket",
  "destination_address",
]);

export const SafePhraseSceneSchema = z.enum([
  "taxi",
  "restaurant",
  "venue_entry",
  "hotel",
  "medical",
  "emergency",
]);

export const SafePhraseSeveritySchema = z.enum(["standard", "severe"]);

export const SafePhraseStatusSchema = z.enum(["draft", "reviewed", "deprecated", "rejected"]);

export const SafePhraseReviewPolicySchema = z.literal("operator-verified-90d-v1");

export const SafePhraseSchema = z
  .object({
    id: z.string().uuid(),
    category: SafePhraseCategorySchema,
    scene: SafePhraseSceneSchema,
    // Stable machine keys let a caller ask for one exact reviewed expression without matching prose.
    intentKey: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    variantKey: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
    severity: SafePhraseSeveritySchema,
    chineseExpression: z.string().trim().min(1).max(500),
    englishIntent: z.string().trim().min(1).max(500),
    sourceClass: z.literal("operator_verified"),
    sourceLocator: PoiFactSourceLocatorSchema,
    evidenceSummary: PoiFactEvidenceSummarySchema,
    verifiedBy: z.string().uuid().nullable().default(null),
    verifiedAt: z.string().datetime().nullable().default(null),
    expiresAt: z.string().datetime().nullable().default(null),
    reviewPolicy: SafePhraseReviewPolicySchema.nullable().default(null),
    status: SafePhraseStatusSchema.default("draft"),
    createdAt: z.string().datetime(),
  })
  .superRefine((phrase, context) => {
    if (phrase.status !== "reviewed") return;

    if (
      phrase.verifiedBy === null ||
      phrase.verifiedAt === null ||
      phrase.expiresAt === null ||
      phrase.reviewPolicy === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "A reviewed safe phrase requires an operator, verification, expiry, and review policy",
      });
      return;
    }

    const verifiedAt = Date.parse(phrase.verifiedAt);
    const expiresAt = Date.parse(phrase.expiresAt);
    const maximumExpiry = verifiedAt + 90 * 24 * 60 * 60 * 1000;
    if (!Number.isFinite(verifiedAt) || !Number.isFinite(expiresAt) || expiresAt <= verifiedAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reviewed safe phrase must expire after it was verified",
      });
    } else if (expiresAt > maximumExpiry) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A reviewed safe phrase cannot outlive the 90-day operator review policy",
      });
    }
  });

export const SafePhraseSelectionSchema = z.object({
  category: SafePhraseCategorySchema,
  scene: SafePhraseSceneSchema,
  intentKey: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  variantKey: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/),
  severity: SafePhraseSeveritySchema,
});

export type SafePhraseCategory = z.infer<typeof SafePhraseCategorySchema>;
export type SafePhraseScene = z.infer<typeof SafePhraseSceneSchema>;
export type SafePhraseSeverity = z.infer<typeof SafePhraseSeveritySchema>;
export type SafePhrase = z.infer<typeof SafePhraseSchema>;
export type SafePhraseSelection = z.infer<typeof SafePhraseSelectionSchema>;

export function isEligibleSafePhrase(phrase: SafePhrase, now = new Date()): boolean {
  if (
    phrase.status !== "reviewed" ||
    phrase.verifiedBy === null ||
    phrase.verifiedAt === null ||
    phrase.expiresAt === null ||
    phrase.reviewPolicy !== "operator-verified-90d-v1"
  ) {
    return false;
  }

  const verifiedAt = Date.parse(phrase.verifiedAt);
  const expiresAt = Date.parse(phrase.expiresAt);
  return (
    Number.isFinite(verifiedAt) &&
    Number.isFinite(expiresAt) &&
    verifiedAt <= now.getTime() &&
    expiresAt >= now.getTime() &&
    expiresAt <= verifiedAt + 90 * 24 * 60 * 60 * 1000
  );
}

// An exact match is required. In particular, a severe phrase can never be substituted with a
// standard phrase (or vice versa), even when all other selection fields happen to match.
export function resolveEligibleSafePhrase(
  phrases: readonly SafePhrase[],
  selection: SafePhraseSelection,
  now = new Date(),
): SafePhrase | null {
  const matches = phrases.filter(
    (phrase) =>
      isEligibleSafePhrase(phrase, now) &&
      phrase.category === selection.category &&
      phrase.scene === selection.scene &&
      phrase.intentKey === selection.intentKey &&
      phrase.variantKey === selection.variantKey &&
      phrase.severity === selection.severity,
  );

  return matches.length === 1 ? (matches[0] ?? null) : null;
}
