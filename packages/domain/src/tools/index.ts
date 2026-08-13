import { z } from "zod";

export const TOOLS_CONTENT_PACK_VERSION = 1 as const;

export const ToolContentPackIdSchema = z.enum([
  "payment_prep",
  "network_esim",
  "emergency_boundary",
  "transport",
  "entry_checklist",
  "offline_pack",
  "currency",
  "translation",
]);

export const ToolContentActionIdSchema = z.enum([
  "review_payment_plan",
  "review_network_plan",
  "open_emergency_guidance",
  "review_arrival_transport",
  "review_entry_requirements",
  "save_first_day_information",
  "check_currency_before_exchange",
  "open_translation_support",
]);

export const ToolContentPackItemSchema = z
  .object({
    id: ToolContentPackIdSchema,
    title: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(240),
    steps: z.array(z.string().trim().min(1).max(280)).min(2).max(4),
    actionId: ToolContentActionIdSchema,
    actionLabel: z.string().trim().min(1).max(80),
    availability: z.literal("local_content_only"),
  })
  .strict();

export const ToolsContentPackSchema = z
  .object({
    version: z.literal(TOOLS_CONTENT_PACK_VERSION),
    items: z.array(ToolContentPackItemSchema).length(8),
  })
  .strict()
  .superRefine((pack, context) => {
    const ids = pack.items.map((item) => item.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["items"],
        message: "Tool content pack item ids must be unique",
      });
    }
  });

export type ToolContentPackId = z.infer<typeof ToolContentPackIdSchema>;
export type ToolContentActionId = z.infer<typeof ToolContentActionIdSchema>;
export type ToolContentPackItem = z.infer<typeof ToolContentPackItemSchema>;
export type ToolsContentPack = z.infer<typeof ToolsContentPackSchema>;

/**
 * Portable, local-only preparation content. These are user tasks, not claims that a partner,
 * booking, exchange rate, emergency responder, or language service is available.
 */
export const TOOLS_CONTENT_PACK: ToolsContentPack = ToolsContentPackSchema.parse({
  version: TOOLS_CONTENT_PACK_VERSION,
  items: [
    {
      id: "payment_prep",
      title: "Payment prep",
      summary: "Keep a primary payment plan and a fallback before you arrive.",
      steps: [
        "Confirm the payment method you plan to use.",
        "Keep a fallback card or small cash reserve for edge cases.",
      ],
      actionId: "review_payment_plan",
      actionLabel: "Review payment plan",
      availability: "local_content_only",
    },
    {
      id: "network_esim",
      title: "Network and eSIM",
      summary: "Prepare connectivity before landing and keep essential information offline.",
      steps: [
        "Confirm how you will access mobile data after arrival.",
        "Save your first destination and support details where you can read them offline.",
      ],
      actionId: "review_network_plan",
      actionLabel: "Review network plan",
      availability: "local_content_only",
    },
    {
      id: "emergency_boundary",
      title: "Emergency guidance",
      summary: "For immediate danger or serious illness, use the appropriate official service now.",
      steps: [
        "Do not wait for an app response in an urgent situation.",
        "Keep your accommodation, insurer, and consular contact details accessible.",
      ],
      actionId: "open_emergency_guidance",
      actionLabel: "Open emergency guidance",
      availability: "local_content_only",
    },
    {
      id: "transport",
      title: "Arrival transport",
      summary: "Prepare a first journey and a simple fallback before you land.",
      steps: [
        "Save your destination name and address in a form you can show locally.",
        "Keep a fallback route if your first transport option is unavailable.",
      ],
      actionId: "review_arrival_transport",
      actionLabel: "Review arrival transport",
      availability: "local_content_only",
    },
    {
      id: "entry_checklist",
      title: "Entry checklist",
      summary: "Check the documents and bookings you will rely on before departure.",
      steps: [
        "Compare names on bookings with the travel document you will use.",
        "Confirm requirements with the relevant official or booking source before travel.",
      ],
      actionId: "review_entry_requirements",
      actionLabel: "Review entry checklist",
      availability: "local_content_only",
    },
    {
      id: "offline_pack",
      title: "Offline pack",
      summary: "Keep the first day usable when a connection is delayed or unavailable.",
      steps: [
        "Save accommodation details, first-day plan, and key contacts offline.",
        "Do not store passwords, payment credentials, or document numbers in a shared note.",
      ],
      actionId: "save_first_day_information",
      actionLabel: "Prepare offline information",
      availability: "local_content_only",
    },
    {
      id: "currency",
      title: "Currency",
      summary: "Treat exchange information as time-sensitive and confirm it before acting.",
      steps: [
        "Check the current rate with your bank or chosen exchange provider.",
        "Keep receipts and understand any fees before you exchange money.",
      ],
      actionId: "check_currency_before_exchange",
      actionLabel: "Check before exchange",
      availability: "local_content_only",
    },
    {
      id: "translation",
      title: "Translation",
      summary: "Prepare a clear way to show addresses and essential requests in Chinese.",
      steps: [
        "Keep important place names or requests in a form you can show on screen.",
        "For urgent or high-risk requests, use reviewed guidance rather than generated wording.",
      ],
      actionId: "open_translation_support",
      actionLabel: "Open translation support",
      availability: "local_content_only",
    },
  ],
});

export function getToolContentPackItem(id: ToolContentPackId): ToolContentPackItem {
  const item = TOOLS_CONTENT_PACK.items.find((candidate) => candidate.id === id);
  if (!item) throw new Error(`Missing Tool content item for ${id}`);
  return item;
}
