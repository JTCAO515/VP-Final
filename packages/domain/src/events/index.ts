import { z } from "zod";
import { CopilotIntentSchema } from "../copilot/index.js";

export const TelemetryEventBaseSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().optional(),
  anon_id: z.string().min(1).optional(),
  surface: z.enum(["web", "mobile", "server", "ops"]),
  action: z.string().min(1),
  entity_type: z.string().min(1),
  entity_id: z.string().optional(),
  intent: CopilotIntentSchema.optional(),
  partner: z.string().optional(),
  click_id: z.string().optional(),
  props_jsonb: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
});

function requireTelemetryIdentity(
  event: { user_id?: string | undefined; anon_id?: string | undefined },
  ctx: z.RefinementCtx,
) {
  if (!event.user_id && !event.anon_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Telemetry events require a trusted user or anonymous identity",
    });
  }
}

export const TelemetryEventSchema = TelemetryEventBaseSchema.superRefine(requireTelemetryIdentity);

export const TelemetryEventInputSchema = TelemetryEventBaseSchema.omit({
  id: true,
  created_at: true,
})
  .extend({
    id: TelemetryEventBaseSchema.shape.id.optional(),
    created_at: TelemetryEventBaseSchema.shape.created_at.optional(),
  })
  .superRefine(requireTelemetryIdentity);

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
