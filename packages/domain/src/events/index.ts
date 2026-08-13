import { z } from "zod";
import { CopilotIntentSchema } from "../copilot/index.js";
import { RescueCategorySchema, RescuePrimaryActionKindSchema } from "../rescue/index.js";
import { ShowToLocalCategorySchema } from "../show-to-local/index.js";
import { ToolContentPackIdSchema } from "../tools/index.js";

export const ExistingCopilotEventActionSchema = z.enum([
  "session_started",
  "turn_completed",
  "anon_limit_hit",
  "rate_limited",
  "register_prompt_shown",
  "fallback_triggered",
  "model_failure",
  "cost_pricing_missing",
  "daily_budget_exceeded",
]);

export const PhaseZeroTelemetryActionSchema = z.enum([
  "prompt_submitted",
  "skeleton_received",
  "details_completed",
  "patch_applied",
  "copilot_failed",
  "human_help_suggested",
  "guide_viewed",
  "poi_viewed",
  "scene_filter_used",
  "outbound_clicked",
  "partner_redirected",
  "human_help_viewed",
  "task_started",
  "task_submitted",
  "quote_created",
  "payment_link_clicked",
  "task_paid",
  "task_done",
]);

export const RescueTelemetryActionSchema = z.enum([
  "rescue_started",
  "rescue_route_selected",
  "human_help_offered",
  "human_help_confirmed",
  "resolution_outcome",
]);

export const ArrivalPackTelemetryActionSchema = z.enum([
  "arrival_pack_generated",
  "arrival_pack_downloaded",
  "arrival_pack_regenerated",
]);

export const MobileTelemetryActionSchema = z.enum([
  "app_opened",
  "trip_opened",
  "offline_content_used",
  "tool_opened",
  "show_to_local_used",
  "human_help_submitted",
]);

export const TelemetryActionSchema = z.union([
  ExistingCopilotEventActionSchema,
  PhaseZeroTelemetryActionSchema,
  RescueTelemetryActionSchema,
  ArrivalPackTelemetryActionSchema,
  MobileTelemetryActionSchema,
]);

export const ClientTelemetryActionSchema = z.enum([
  "guide_viewed",
  "poi_viewed",
  "scene_filter_used",
  "human_help_viewed",
  "task_started",
  "rescue_started",
  "rescue_route_selected",
  "arrival_pack_generated",
  "arrival_pack_downloaded",
  "arrival_pack_regenerated",
]);

const IdentifierSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/);
const DimensionSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N} .&'()_/-]*$/u);
const FailureClassSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/);
const FixedPointUsdSchema = z.string().regex(/^(0|[1-9]\d*)\.\d{8}$/);

export const DailyBudgetExceededPropsSchema = z
  .object({
    budgetUsd: FixedPointUsdSchema,
    observedCostUsd: FixedPointUsdSchema,
  })
  .strict();

const EmptyPropsSchema = z.object({}).strict();
const ModelAttemptPropsSchema = z
  .object({
    provider: IdentifierSchema,
    model: IdentifierSchema,
    attemptIndex: z.number().int().positive(),
  })
  .strict();
const FailurePropsSchema = z.object({ failureClass: FailureClassSchema }).strict();
const ExplorePropsSchema = z
  .object({
    city: DimensionSchema.optional(),
    category: DimensionSchema.optional(),
    scene: DimensionSchema.optional(),
  })
  .strict();
const OutboundPropsSchema = z
  .object({
    city: DimensionSchema.optional(),
    category: DimensionSchema.optional(),
  })
  .strict();
const HumanHelpPropsSchema = z
  .object({
    city: DimensionSchema.optional(),
    kind: DimensionSchema.optional(),
  })
  .strict();
const RescueCategoryPropsSchema = z
  .object({
    category: RescueCategorySchema,
  })
  .strict();
const RescueRouteSelectedPropsSchema = RescueCategoryPropsSchema.extend({
  primaryActionKind: RescuePrimaryActionKindSchema,
}).strict();
const RescueOutcomePropsSchema = RescueRouteSelectedPropsSchema.extend({
  outcome: z.enum([
    "not_recorded",
    "unavailable",
    "official_guidance",
    "reviewed_tool",
    "show_to_local",
  ]),
}).strict();
const ArrivalPackPropsSchema = z
  .object({
    packVersion: z.literal(1),
    firstDayBlockCount: z.number().int().nonnegative().max(50),
    reviewedAddressCount: z.number().int().nonnegative().max(20),
    readinessIncluded: z.boolean(),
  })
  .strict();
const MobileTripOpenedPropsSchema = z.object({ version: z.number().int().positive() }).strict();
const MobileOfflineContentPropsSchema = z.object({ cacheVersion: z.literal(1) }).strict();
const MobileToolOpenedPropsSchema = z.object({ tool: ToolContentPackIdSchema }).strict();
const MobileShowToLocalPropsSchema = z.object({ category: ShowToLocalCategorySchema }).strict();

const TelemetryPropsSchemas = {
  session_started: EmptyPropsSchema,
  turn_completed: EmptyPropsSchema,
  anon_limit_hit: z.object({ limit: z.number().int().positive() }).strict(),
  rate_limited: z.object({ retryAfterSeconds: z.number().int().nonnegative() }).strict(),
  register_prompt_shown: z.object({ reason: z.enum(["anonymous_turn_limit"]) }).strict(),
  fallback_triggered: ModelAttemptPropsSchema,
  model_failure: FailurePropsSchema,
  cost_pricing_missing: ModelAttemptPropsSchema,
  daily_budget_exceeded: DailyBudgetExceededPropsSchema,
  prompt_submitted: EmptyPropsSchema,
  skeleton_received: EmptyPropsSchema,
  details_completed: EmptyPropsSchema,
  patch_applied: EmptyPropsSchema,
  copilot_failed: FailurePropsSchema,
  human_help_suggested: HumanHelpPropsSchema,
  guide_viewed: ExplorePropsSchema,
  poi_viewed: ExplorePropsSchema,
  scene_filter_used: ExplorePropsSchema,
  outbound_clicked: OutboundPropsSchema,
  partner_redirected: OutboundPropsSchema,
  human_help_viewed: HumanHelpPropsSchema,
  task_started: HumanHelpPropsSchema,
  task_submitted: HumanHelpPropsSchema,
  quote_created: HumanHelpPropsSchema,
  payment_link_clicked: HumanHelpPropsSchema,
  task_paid: HumanHelpPropsSchema,
  task_done: HumanHelpPropsSchema,
  rescue_started: RescueCategoryPropsSchema,
  rescue_route_selected: RescueRouteSelectedPropsSchema,
  human_help_offered: RescueCategoryPropsSchema,
  human_help_confirmed: RescueCategoryPropsSchema,
  resolution_outcome: RescueOutcomePropsSchema,
  arrival_pack_generated: ArrivalPackPropsSchema,
  arrival_pack_downloaded: ArrivalPackPropsSchema,
  arrival_pack_regenerated: ArrivalPackPropsSchema,
  app_opened: EmptyPropsSchema,
  trip_opened: MobileTripOpenedPropsSchema,
  offline_content_used: MobileOfflineContentPropsSchema,
  tool_opened: MobileToolOpenedPropsSchema,
  show_to_local_used: MobileShowToLocalPropsSchema,
  human_help_submitted: EmptyPropsSchema,
} satisfies Record<z.infer<typeof TelemetryActionSchema>, z.ZodType<Record<string, unknown>>>;

const RESTRICTED_KEY =
  /(?:authorization|api[_-]?key|contact|cookie|description|email|message|narrative|password|phone|prompt|signature|secret|token)/i;
const RESTRICTED_TEXT = [
  /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
  /\b(?:\+?\d[\d\s()-]{6,}\d)\b/,
  /\b(?:sk[-_]|sb_secret_)[A-Za-z0-9._-]{12,}\b/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/i,
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
];
const SAFE_NUMERIC_TEXT = /^\d+(?:\.\d+)?$/;

export function containsRestrictedTelemetryMaterial(value: unknown): boolean {
  if (typeof value === "string") {
    if (SAFE_NUMERIC_TEXT.test(value)) return false;
    return RESTRICTED_TEXT.some((pattern) => pattern.test(value));
  }
  if (Array.isArray(value)) return value.some(containsRestrictedTelemetryMaterial);
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, nested]) => RESTRICTED_KEY.test(key) || containsRestrictedTelemetryMaterial(nested),
    );
  }
  return false;
}

export function validateTelemetryProperties(
  action: z.infer<typeof TelemetryActionSchema>,
  properties: Record<string, unknown>,
): boolean {
  return (
    !containsRestrictedTelemetryMaterial(properties) &&
    TelemetryPropsSchemas[action].safeParse(properties).success
  );
}

export const TelemetryEventBaseSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  anon_id: z
    .string()
    .trim()
    .min(1)
    .max(128)
    .regex(/^[A-Za-z0-9_-]+$/)
    .optional(),
  surface: z.enum(["web", "mobile", "server", "ops"]),
  action: TelemetryActionSchema,
  entity_type: IdentifierSchema,
  entity_id: IdentifierSchema.optional(),
  intent: CopilotIntentSchema.optional(),
  partner: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9._-]*$/)
    .optional(),
  click_id: z.string().uuid().optional(),
  props_jsonb: z.record(z.unknown()).default({}),
  created_at: z.string().datetime(),
});

function requireExactlyOneTelemetryIdentity(
  event: { user_id?: string | undefined; anon_id?: string | undefined },
  ctx: z.RefinementCtx,
) {
  if (Number(Boolean(event.user_id)) + Number(Boolean(event.anon_id)) !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Telemetry events require exactly one trusted identity",
    });
  }
}

function requireActionContract(
  event: {
    action: z.infer<typeof TelemetryActionSchema>;
    partner?: string | undefined;
    click_id?: string | undefined;
    props_jsonb: Record<string, unknown>;
  },
  ctx: z.RefinementCtx,
) {
  if (!validateTelemetryProperties(event.action, event.props_jsonb)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["props_jsonb"],
      message: "Telemetry properties must match the registered action allowlist",
    });
  }
  if (
    (event.action === "outbound_clicked" || event.action === "partner_redirected") &&
    (!event.partner || !event.click_id)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Outbound telemetry requires a partner and durable click id",
    });
  }
}

export const TelemetryEventSchema = TelemetryEventBaseSchema.extend({
  retention_expires_at: z.string().datetime(),
}).superRefine((event, ctx) => {
  requireExactlyOneTelemetryIdentity(event, ctx);
  requireActionContract(event, ctx);
  if (Date.parse(event.retention_expires_at) <= Date.parse(event.created_at)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["retention_expires_at"],
      message: "Telemetry retention deadline must be after creation",
    });
  }
});

export const TelemetryCaptureInputSchema = z
  .object({
    action: ClientTelemetryActionSchema,
    entity_type: IdentifierSchema,
    entity_id: IdentifierSchema.optional(),
    props_jsonb: z.record(z.unknown()).default({}),
  })
  .strict()
  .superRefine((event, ctx) => requireActionContract(event, ctx));

/**
 * Native telemetry carries a client-generated UUID only for idempotent offline retry. The server
 * still derives identity, surface, timestamps, and retention after online session validation.
 */
export const MobileTelemetryCaptureInputSchema = z
  .object({
    id: z.string().uuid(),
    action: MobileTelemetryActionSchema,
    entity_type: IdentifierSchema,
    entity_id: IdentifierSchema.optional(),
    props_jsonb: z.record(z.unknown()).default({}),
  })
  .strict()
  .superRefine((event, ctx) => requireActionContract(event, ctx));

export const TelemetryEventInputSchema = TelemetryCaptureInputSchema;

export type TelemetryAction = z.infer<typeof TelemetryActionSchema>;
export type ClientTelemetryAction = z.infer<typeof ClientTelemetryActionSchema>;
export type TelemetryCaptureInput = z.infer<typeof TelemetryCaptureInputSchema>;
export type MobileTelemetryCaptureInput = z.infer<typeof MobileTelemetryCaptureInputSchema>;
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
