import { z } from "zod";
import { CopilotIntentSchema } from "../copilot/index.js";

export const TelemetryEventSchema = z.object({
  id: z.string().min(1),
  user_id: z.string().optional(),
  anon_id: z.string().min(1),
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

export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
