import { z } from "zod";

export const SHOW_TO_LOCAL_PHRASE_PACK_VERSION = "show-to-local-v1" as const;

export const ShowToLocalCategorySchema = z.enum([
  "restaurant",
  "taxi",
  "hotel",
  "allergy",
  "symptom",
  "emergency",
]);

const ShowToLocalAvailablePhraseSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    category: z.enum(["restaurant", "taxi", "hotel"]),
    availability: z.literal("available"),
    title: z.string().trim().min(1).max(80),
    englishText: z.string().trim().min(1).max(280),
    chineseText: z.string().trim().min(1).max(280),
  })
  .strict();

const ShowToLocalUnavailablePhraseSchema = z
  .object({
    id: z.string().trim().min(1).max(80),
    category: z.enum(["allergy", "symptom", "emergency"]),
    availability: z.literal("unavailable"),
    title: z.string().trim().min(1).max(80),
    fallback: z.string().trim().min(1).max(500),
  })
  .strict();

export const ShowToLocalPhraseCardSchema = z.discriminatedUnion("availability", [
  ShowToLocalAvailablePhraseSchema,
  ShowToLocalUnavailablePhraseSchema,
]);

export const ShowToLocalPhrasePackSchema = z
  .object({
    version: z.literal(SHOW_TO_LOCAL_PHRASE_PACK_VERSION),
    cards: z.array(ShowToLocalPhraseCardSchema).length(6),
  })
  .strict()
  .superRefine((pack, context) => {
    const categories = pack.cards.map((card) => card.category);
    if (new Set(categories).size !== categories.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cards"],
        message: "Show to Local categories must be unique",
      });
    }

    const expectedCategories = ShowToLocalCategorySchema.options;
    if (!expectedCategories.every((category) => categories.includes(category))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cards"],
        message: "Show to Local pack must include every declared category",
      });
    }
  });

export type ShowToLocalCategory = z.infer<typeof ShowToLocalCategorySchema>;
export type ShowToLocalPhraseCard = z.infer<typeof ShowToLocalPhraseCardSchema>;
export type ShowToLocalPhrasePack = z.infer<typeof ShowToLocalPhrasePackSchema>;
export type ShowToLocalAvailablePhraseCard = Extract<
  ShowToLocalPhraseCard,
  { availability: "available" }
>;

/**
 * Static, ordinary phrases are deliberately limited to routine requests. High-risk categories
 * contain ADR-0016's exact English fallback until an operator-reviewed, current fixed expression
 * can be supplied through a later controlled sync.
 */
export const SHOW_TO_LOCAL_PHRASE_PACK: ShowToLocalPhrasePack = ShowToLocalPhrasePackSchema.parse({
  version: SHOW_TO_LOCAL_PHRASE_PACK_VERSION,
  cards: [
    {
      id: "restaurant-order-help",
      category: "restaurant",
      availability: "available",
      title: "Restaurant",
      englishText: "Please help me order this.",
      chineseText: "请帮我点这个。",
    },
    {
      id: "taxi-destination-help",
      category: "taxi",
      availability: "available",
      title: "Taxi",
      englishText: "Please take me to this destination.",
      chineseText: "请带我去这个目的地。",
    },
    {
      id: "hotel-check-in-help",
      category: "hotel",
      availability: "available",
      title: "Hotel",
      englishText: "I have a reservation. Please help me check in.",
      chineseText: "我有预订，请帮我办理入住。",
    },
    {
      id: "allergy-verified-card-unavailable",
      category: "allergy",
      availability: "unavailable",
      title: "Allergy or dietary restriction",
      fallback:
        "I can’t safely create a card for this allergy or dietary restriction. Please use a verified card or ask the venue to confirm ingredients before consuming.",
    },
    {
      id: "symptom-verified-card-unavailable",
      category: "symptom",
      availability: "unavailable",
      title: "Symptoms or medical wording",
      fallback:
        "I can’t safely create a medical translation for this request. Please contact a qualified clinician or pharmacist; for urgent danger, contact local emergency services.",
    },
    {
      id: "emergency-verified-card-unavailable",
      category: "emergency",
      availability: "unavailable",
      title: "Emergency help",
      fallback:
        "I can’t create an emergency request card for this situation. Contact local emergency services, your accommodation, insurer, or consulate as appropriate.",
    },
  ],
});

export function isAvailableShowToLocalPhrase(
  card: ShowToLocalPhraseCard,
): card is ShowToLocalAvailablePhraseCard {
  return card.availability === "available";
}

export function getShowToLocalPhraseCard(category: ShowToLocalCategory): ShowToLocalPhraseCard {
  const card = SHOW_TO_LOCAL_PHRASE_PACK.cards.find((candidate) => candidate.category === category);
  if (!card) throw new Error(`Missing Show to Local phrase card for ${category}`);
  return card;
}
