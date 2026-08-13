import { z } from "zod";

export const SeoPageIntentSchema = z.enum([
  "payment",
  "transport",
  "ticket",
  "first_timer",
  "rainy_day",
]);

export type SeoPageIntent = z.infer<typeof SeoPageIntentSchema>;
