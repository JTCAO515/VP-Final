import { z } from "zod";

export const EARLY_ACCESS_EMAIL_MAX_LENGTH = 254;
export const EARLY_ACCESS_LOCALE_MAX_LENGTH = 16;
export const EARLY_ACCESS_PRIMARY_CONCERNS = [
  "payment_and_cash",
  "transport_and_navigation",
  "internet_and_essential_apps",
  "language_and_communication",
  "entry_tickets_and_booking",
  "finding_places_and_addresses",
  "food_and_dietary_needs",
  "accommodation_and_check_in",
  "changing_plans_or_getting_help",
  "something_else",
] as const;

export const EarlyAccessPrimaryConcernSchema = z.enum(EARLY_ACCESS_PRIMARY_CONCERNS);

/** Canonicalizes the one personal-data value accepted by the Early Access boundary. */
export function normalizeEarlyAccessEmail(email: string): string {
  return email.trim().toLowerCase();
}

export const EarlyAccessSignupInputSchema = z.object({
  email: z
    .string()
    .transform(normalizeEarlyAccessEmail)
    .pipe(z.string().email().max(EARLY_ACCESS_EMAIL_MAX_LENGTH)),
  locale: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{2,16}$/)
    .default("en"),
  // The public acquisition route has exactly one registered source. A new source needs its own
  // contract so client input cannot silently rewrite attribution.
  source: z.literal("landing").default("landing"),
  // A fixed optional acquisition-priority signal. Free text needs a separate privacy and review
  // contract because it can carry sensitive personal or travel details.
  primaryConcern: EarlyAccessPrimaryConcernSchema.optional(),
});

export const EarlyAccessSignupResultSchema = z.object({
  status: z.enum(["subscribed", "already_subscribed"]),
});

export type EarlyAccessSignupInput = z.infer<typeof EarlyAccessSignupInputSchema>;
export type EarlyAccessSignupResult = z.infer<typeof EarlyAccessSignupResultSchema>;
export type EarlyAccessPrimaryConcern = z.infer<typeof EarlyAccessPrimaryConcernSchema>;
