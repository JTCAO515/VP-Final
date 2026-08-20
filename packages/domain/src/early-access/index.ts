import { z } from "zod";

export const EARLY_ACCESS_EMAIL_MAX_LENGTH = 254;
export const EARLY_ACCESS_LOCALE_MAX_LENGTH = 16;

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
});

export const EarlyAccessSignupResultSchema = z.object({
  status: z.enum(["subscribed", "already_subscribed"]),
});

export type EarlyAccessSignupInput = z.infer<typeof EarlyAccessSignupInputSchema>;
export type EarlyAccessSignupResult = z.infer<typeof EarlyAccessSignupResultSchema>;
