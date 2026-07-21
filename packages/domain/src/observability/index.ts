import { z } from "zod";
import { CopilotEnvelopeSchema } from "../copilot/index.js";
import { TelemetryEventBaseSchema } from "../events/index.js";

export const CopilotProductEventActionSchema = z.enum([
  "session_started",
  "turn_completed",
  "anon_limit_hit",
  "rate_limited",
  "register_prompt_shown",
  "fallback_triggered",
  "model_failure",
  "cost_pricing_missing",
]);

export const ConversationRedactionClassSchema = z.enum([
  "email",
  "phone",
  "travel_document",
  "credential",
  "cookie",
  "signature",
]);

export const ModelEffortSchema = z.enum(["low", "medium", "high"]);

const FORBIDDEN_KEY = /(?:authorization|api[_-]?key|cookie|set[_-]?cookie|signature|secret)/i;
const FORBIDDEN_TEXT = [
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
  /\b(?:\+?\d[\d\s()-]{6,}\d)\b/,
  /\b(?:sk[-_]|sb_secret_)[A-Za-z0-9._-]{12,}\b/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
  /\b(?:passport|visa|travel document)(?:\s+(?:number|no\.?))?\s*[:#-]?\s*[A-Z0-9]{6,12}\b/i,
];

export function containsForbiddenConversationMaterial(value: unknown): boolean {
  if (typeof value === "string") {
    return FORBIDDEN_TEXT.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) {
    return value.some(containsForbiddenConversationMaterial);
  }
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, nested]) => FORBIDDEN_KEY.test(key) || containsForbiddenConversationMaterial(nested),
    );
  }
  return false;
}

export const RedactedConversationTextSchema = z
  .string()
  .trim()
  .min(1)
  .max(12_000)
  .refine((value) => !containsForbiddenConversationMaterial(value), {
    message: "Conversation text must be redacted before persistence",
  });

export const PersistedCopilotEnvelopeSchema = CopilotEnvelopeSchema.refine(
  (value) => !containsForbiddenConversationMaterial(value),
  { message: "Copilot envelope must be redacted before persistence" },
);

const RecordIdentitySchema = z
  .object({
    user_id: z.string().uuid().nullable().default(null),
    anon_id: z.string().min(1).nullable().default(null),
  })
  .superRefine((identity, ctx) => {
    if (Number(identity.user_id !== null) + Number(identity.anon_id !== null) !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Exactly one trusted conversation identity is required",
      });
    }
  });

export const CopilotConversationTurnSchema = z
  .object({
    id: z.string().uuid(),
    session_id: z.string().uuid(),
    agent_run_id: z.string().uuid().nullable().default(null),
    identity: RecordIdentitySchema,
    status: z.enum(["succeeded", "failed"]),
    user_message: RedactedConversationTextSchema,
    assistant_envelope: PersistedCopilotEnvelopeSchema.nullable().default(null),
    city_intent: z.string().trim().min(1).max(80).nullable().default(null),
    redaction_classes: z.array(ConversationRedactionClassSchema).default([]),
    failure_class: z.string().trim().min(1).max(80).nullable().default(null),
    created_at: z.string().datetime(),
    retention_expires_at: z.string().datetime(),
  })
  .superRefine((turn, ctx) => {
    const successShape = turn.assistant_envelope !== null && turn.failure_class === null;
    const failureShape = turn.assistant_envelope === null && turn.failure_class !== null;
    if (
      (turn.status === "succeeded" && !successShape) ||
      (turn.status === "failed" && !failureShape)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["status"],
        message: "Conversation result fields must match the turn status",
      });
    }
    if (Date.parse(turn.retention_expires_at) <= Date.parse(turn.created_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retention_expires_at"],
        message: "Conversation retention deadline must be after creation",
      });
    }
  });

export const LlmCallCostRecordSchema = z
  .object({
    id: z.string().uuid(),
    agent_run_id: z.string().uuid(),
    identity: RecordIdentitySchema,
    attempt_index: z.number().int().positive(),
    provider: z.string().trim().min(1).max(80),
    model: z.string().trim().min(1).max(160),
    effort: ModelEffortSchema,
    status: z.enum(["succeeded", "failed"]),
    input_tokens: z.number().int().nonnegative(),
    cached_input_tokens: z.number().int().nonnegative().default(0),
    output_tokens: z.number().int().nonnegative(),
    input_price_per_million_usd: z.number().nonnegative(),
    cached_input_price_per_million_usd: z.number().nonnegative().default(0),
    output_price_per_million_usd: z.number().nonnegative(),
    cost_usd: z.number().nonnegative(),
    fallback_triggered: z.boolean(),
    latency_ms: z.number().int().nonnegative(),
    failure_class: z.string().trim().min(1).max(80).nullable().default(null),
    created_at: z.string().datetime(),
    retention_expires_at: z.string().datetime(),
  })
  .superRefine((record, ctx) => {
    if (record.cached_input_tokens > record.input_tokens) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cached_input_tokens"],
        message: "Cached input tokens must not exceed total input tokens",
      });
    }
    if (record.status === "succeeded" && record.failure_class !== null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failure_class"],
        message: "Successful calls cannot carry a failure class",
      });
    }
    if (record.status === "failed" && record.failure_class === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["failure_class"],
        message: "Failed calls require a normalized failure class",
      });
    }
    if (Date.parse(record.retention_expires_at) <= Date.parse(record.created_at)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["retention_expires_at"],
        message: "Cost retention deadline must be after creation",
      });
    }
  });

export const CopilotProductEventSchema = TelemetryEventBaseSchema.extend({
  action: CopilotProductEventActionSchema,
  retention_expires_at: z.string().datetime(),
}).superRefine((event, ctx) => {
  if (!event.user_id && !event.anon_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Copilot product events require a trusted user or anonymous identity",
    });
  }
  if (containsForbiddenConversationMaterial(event.props_jsonb)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["props_jsonb"],
      message: "Copilot product event properties must not contain restricted material",
    });
  }
  if (Date.parse(event.retention_expires_at) <= Date.parse(event.created_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["retention_expires_at"],
      message: "Copilot product event retention deadline must be after creation",
    });
  }
});

export type CopilotConversationTurn = z.infer<typeof CopilotConversationTurnSchema>;
export type LlmCallCostRecord = z.infer<typeof LlmCallCostRecordSchema>;
export type CopilotProductEventAction = z.infer<typeof CopilotProductEventActionSchema>;
export type ConversationRedactionClass = z.infer<typeof ConversationRedactionClassSchema>;
