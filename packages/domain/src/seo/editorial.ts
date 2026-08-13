import { z } from "zod";
import { SeoPageIntentSchema } from "./intents.js";

const EditorialTextSchema = z.string().trim().min(1).max(600);

const SeoEditorialOverrideMutationBaseSchema = z
  .object({
    poiId: z.string().uuid(),
    intent: SeoPageIntentSchema,
    title: z.string().trim().min(1).max(140).nullable(),
    summary: z.string().trim().min(1).max(240).nullable(),
    emphasis: EditorialTextSchema.nullable(),
  })
  .strict();

function requireEditorialPresentation(
  override: z.infer<typeof SeoEditorialOverrideMutationBaseSchema>,
  context: z.RefinementCtx,
) {
  if (override.title === null && override.summary === null && override.emphasis === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "An editorial override must replace at least one presentation field",
    });
  }
}

export const SeoEditorialOverrideMutationSchema =
  SeoEditorialOverrideMutationBaseSchema.superRefine(requireEditorialPresentation);

export const SeoEditorialOverrideSchema = SeoEditorialOverrideMutationBaseSchema.extend({
  updatedAt: z.string().datetime(),
}).superRefine(requireEditorialPresentation);

export type SeoEditorialOverrideMutation = z.infer<typeof SeoEditorialOverrideMutationSchema>;
export type SeoEditorialOverride = z.infer<typeof SeoEditorialOverrideSchema>;

/** Presentation-only merge. It cannot create a candidate, add a fact, or modify POI source data. */
export function applySeoEditorialOverride<T extends { title: string; summary: string }>(
  page: T,
  override: SeoEditorialOverride | null,
): T & { emphasis: string | null } {
  return {
    ...page,
    ...(override?.title === null || override?.title === undefined ? {} : { title: override.title }),
    ...(override?.summary === null || override?.summary === undefined
      ? {}
      : { summary: override.summary }),
    emphasis: override?.emphasis ?? null,
  };
}
