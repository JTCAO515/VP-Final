import { z } from "zod";
import { TripPatchSchema } from "../trip/index.js";

export const CopilotIntentSchema = z.enum([
  "chat_only",
  "trip_create",
  "trip_edit",
  "question",
  "commerce_intent",
  "human_help",
]);

export const CopilotMessageSchema = z.object({
  headline: z.string().min(1),
  body: z.string().min(1),
  highlights: z.array(z.string().min(1)).default([]),
});

export const ToolCardSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["show_to_local", "transport", "payment", "network", "emergency"]),
  title: z.string().min(1),
  body: z.string().min(1),
  payload: z.record(z.unknown()).default({}),
});

export const CommercialActionSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["outbound_link", "human_task", "quote"]),
  label: z.string().min(1),
  partner: z.string().min(1),
  disclosure: z.string().min(1),
  click_id: z.string().min(1),
  url: z.string().url().optional(),
  metadata: z.record(z.unknown()).default({}),
});

export const HumanHelpSchema = z.object({
  kind: z.enum(["task", "quote"]),
  city: z.string().optional(),
  prefill: z.string().min(1),
});

export const RiskSchema = z.object({
  level: z.enum(["low", "medium", "high"]),
  reason: z.string().nullable().default(null),
});

export const CitationSchema = z.object({
  fact_id: z.string().min(1),
  label: z.string().optional(),
  source: z.string().optional(),
});

export const CopilotDebugSchema = z.object({
  profile: z.string().min(1),
  toolsUsed: z.array(z.string().min(1)).default([]),
});

export const CopilotEnvelopeSchema = z
  .object({
    intent: CopilotIntentSchema,
    message: CopilotMessageSchema,
    tripActions: z.array(TripPatchSchema).default([]),
    toolCards: z.array(ToolCardSchema).default([]),
    commercialActions: z.array(CommercialActionSchema).default([]),
    humanHelp: HumanHelpSchema.nullable().default(null),
    risk: RiskSchema.default({ level: "low", reason: null }),
    citations: z.array(CitationSchema).default([]),
    debug: CopilotDebugSchema.optional(),
  })
  .superRefine((envelope, ctx) => {
    if (envelope.intent === "commerce_intent" || envelope.commercialActions.length === 0) {
      return;
    }

    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["commercialActions"],
      message: "commercialActions require commerce_intent",
    });
  });

export type CopilotIntent = z.infer<typeof CopilotIntentSchema>;
export type CopilotEnvelope = z.infer<typeof CopilotEnvelopeSchema>;
