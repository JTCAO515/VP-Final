import { z } from "zod";
import { SeoPageIntentSchema } from "./intents.js";

const EditorialTextSchema = z.string().trim().min(1).max(600);

export const SeoEditorialOverrideSchema = z
  .object({
    poiId: z.string().uuid(),
    intent: SeoPageIntentSchema,
    title: z.string().trim().min(1).max(140).nullable(),
    summary: z.string().trim().min(1).max(240).nullable(),
    emphasis: EditorialTextSchema.nullable(),
    updatedAt: z.string().datetime(),
  })
  .strict()
  .superRefine((override, context) => {
    if (override.title === null && override.summary === null && override.emphasis === null) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "An editorial override must replace at least one presentation field",
      });
    }
  });

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
