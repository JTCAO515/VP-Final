import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgSchema,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const authSchema = pgSchema("auth");
export const authUsers = authSchema.table("users", {
  id: uuid("id").primaryKey(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const opsMemberships = pgTable("ops_memberships", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => authUsers.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  createdBy: uuid("created_by").references(() => authUsers.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const opsAuditEvents = pgTable(
  "ops_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    metadataJsonb: jsonb("metadata_jsonb").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    actorCreatedIdx: index("ops_audit_events_actor_created_idx").on(table.actorId, table.createdAt),
  }),
);

export const trips = pgTable(
  "trips",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    owner: uuid("owner").references(() => users.id, { onDelete: "cascade" }),
    anonId: text("anon_id"),
    shareToken: text("share_token"),
    headVersion: integer("head_version").notNull().default(0),
    snapshotJsonb: jsonb("snapshot_jsonb").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    ownerIdx: index("trips_owner_idx").on(table.owner),
    anonIdx: index("trips_anon_id_idx").on(table.anonId),
    shareTokenUnique: uniqueIndex("trips_share_token_unique").on(table.shareToken),
    headVersionCheck: check("trips_head_version_check", sql`${table.headVersion} >= 0`),
    exactlyOneOwnerCheck: check(
      "trips_exactly_one_owner_check",
      sql`num_nonnulls(${table.owner}, ${table.anonId}) = 1`,
    ),
  }),
);

export const tripEvents = pgTable(
  "trip_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    patchJsonb: jsonb("patch_jsonb").notNull(),
    source: text("source").notNull(),
    completionJobId: uuid("completion_job_id").references(() => copilotCompletionJobs.id, {
      onDelete: "restrict",
    }),
    completionAttempt: integer("completion_attempt"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tripVersionUnique: uniqueIndex("trip_events_trip_id_version_unique").on(
      table.tripId,
      table.version,
    ),
    versionCheck: check("trip_events_version_check", sql`${table.version} > 0`),
    sourceCheck: check(
      "trip_events_source_check",
      sql`${table.source} in ('user_chat', 'user_manual', 'ai_copilot', 'system')`,
    ),
    completionProvenanceCheck: check(
      "trip_events_completion_provenance_check",
      sql`num_nonnulls(${table.completionJobId}, ${table.completionAttempt}) = 0 or (num_nonnulls(${table.completionJobId}, ${table.completionAttempt}) = 2 and ${table.completionAttempt} > 0 and ${table.source} = 'ai_copilot')`,
    ),
    completionJobAttemptUnique: uniqueIndex("trip_events_completion_job_attempt_unique")
      .on(table.completionJobId, table.completionAttempt)
      .where(sql`${table.completionJobId} is not null`),
  }),
);

export const readinessAssessments = pgTable(
  "readiness_assessments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "cascade" }),
    assessmentJsonb: jsonb("assessment_jsonb").notNull(),
    resultJsonb: jsonb("result_jsonb").notNull(),
    consentedAt: timestamp("consented_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }).notNull(),
  },
  (table) => ({
    userCreatedIdx: index("readiness_assessments_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    tripCreatedIdx: index("readiness_assessments_trip_created_idx").on(
      table.tripId,
      table.createdAt,
    ),
    ownerCheck: check(
      "readiness_assessments_user_or_trip_check",
      sql`num_nonnulls(${table.userId}, ${table.tripId}) >= 1`,
    ),
    consentTimeCheck: check(
      "readiness_assessments_consent_time_check",
      sql`${table.consentedAt} <= ${table.createdAt}`,
    ),
    retentionCheck: check(
      "readiness_assessments_retention_check",
      sql`${table.retentionExpiresAt} > ${table.createdAt} and ${table.retentionExpiresAt} <= ${table.createdAt} + interval '180 days'`,
    ),
  }),
);

export const copilotCompletionJobs = pgTable(
  "copilot_completion_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tripId: uuid("trip_id")
      .notNull()
      .references(() => trips.id, { onDelete: "cascade" }),
    baseVersion: integer("base_version").notNull(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    state: text("state").notNull().default("queued"),
    attempt: integer("attempt").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(2),
    errorCode: text("error_code"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tripBaseVersionUnique: uniqueIndex("copilot_completion_jobs_trip_base_version_unique").on(
      table.tripId,
      table.baseVersion,
    ),
    idempotencyKeyUnique: uniqueIndex("copilot_completion_jobs_idempotency_key_unique").on(
      table.idempotencyKey,
    ),
    stateCreatedIdx: index("copilot_completion_jobs_state_created_idx").on(
      table.state,
      table.createdAt,
    ),
    baseVersionCheck: check(
      "copilot_completion_jobs_base_version_check",
      sql`${table.baseVersion} >= 0`,
    ),
    attemptCheck: check("copilot_completion_jobs_attempt_check", sql`${table.attempt} >= 0`),
    maxAttemptsCheck: check(
      "copilot_completion_jobs_max_attempts_check",
      sql`${table.maxAttempts} between 1 and 3`,
    ),
    stateCheck: check(
      "copilot_completion_jobs_state_check",
      sql`${table.state} in ('queued', 'running', 'completed', 'partial', 'failed', 'conflicted')`,
    ),
  }),
);

export const agentRuns = pgTable(
  "agent_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonId: text("anon_id"),
    tripId: uuid("trip_id").references(() => trips.id, { onDelete: "set null" }),
    intent: text("intent"),
    status: text("status").notNull(),
    inputJsonb: jsonb("input_jsonb").notNull().default({}),
    outputJsonb: jsonb("output_jsonb").notNull().default({}),
    error: text("error"),
    inputDigest: text("input_digest"),
    outputDigest: text("output_digest"),
    modelProvider: text("model_provider"),
    model: text("model"),
    effort: text("effort"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    latencyMs: integer("latency_ms").notNull().default(0),
    attemptsJsonb: jsonb("attempts_jsonb").notNull().default([]),
    fallbackUsed: boolean("fallback_used").notNull().default(false),
    validationStatus: text("validation_status").notNull().default("passed"),
    repairCount: integer("repair_count").notNull().default(0),
    failureClass: text("failure_class"),
    expiresAt: timestamp("expires_at", { withTimezone: true })
      .notNull()
      .default(sql`now() + interval '30 days'`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    userCreatedIdx: index("agent_runs_user_created_idx").on(table.userId, table.createdAt),
    anonCreatedIdx: index("agent_runs_anon_created_idx").on(table.anonId, table.createdAt),
    tripCreatedIdx: index("agent_runs_trip_created_idx").on(table.tripId, table.createdAt),
    statusCheck: check(
      "agent_runs_status_check",
      sql`${table.status} in ('started', 'succeeded', 'failed')`,
    ),
    effortCheck: check(
      "agent_runs_effort_check",
      sql`${table.effort} is null or ${table.effort} in ('low', 'medium', 'high')`,
    ),
    costCheck: check("agent_runs_cost_usd_check", sql`${table.costUsd} >= 0`),
    identityCheck: check(
      "agent_runs_at_most_one_identity_check",
      sql`num_nonnulls(${table.userId}, ${table.anonId}) <= 1`,
    ),
    tokenCheck: check(
      "agent_runs_token_counts_check",
      sql`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0`,
    ),
    latencyCheck: check("agent_runs_latency_ms_check", sql`${table.latencyMs} >= 0`),
    repairCheck: check("agent_runs_repair_count_check", sql`${table.repairCount} >= 0`),
    validationCheck: check(
      "agent_runs_validation_status_check",
      sql`${table.validationStatus} in ('passed', 'failed')`,
    ),
  }),
);

export const toolCalls = pgTable(
  "tool_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentRunId: uuid("agent_run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    toolName: text("tool_name").notNull(),
    status: text("status").notNull(),
    inputJsonb: jsonb("input_jsonb").notNull().default({}),
    outputJsonb: jsonb("output_jsonb").notNull().default({}),
    error: text("error"),
    inputDigest: text("input_digest"),
    outputDigest: text("output_digest"),
    latencyMs: integer("latency_ms").notNull().default(0),
    failureClass: text("failure_class"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => ({
    agentRunStartedIdx: index("tool_calls_agent_run_started_idx").on(
      table.agentRunId,
      table.startedAt,
    ),
    statusCheck: check(
      "tool_calls_status_check",
      sql`${table.status} in ('started', 'succeeded', 'failed')`,
    ),
    latencyCheck: check("tool_calls_latency_ms_check", sql`${table.latencyMs} >= 0`),
  }),
);

export const copilotConversationTurns = pgTable(
  "copilot_conversation_turns",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id").notNull(),
    agentRunId: uuid("agent_run_id").references(() => agentRuns.id, { onDelete: "set null" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonId: text("anon_id"),
    status: text("status").notNull(),
    userMessage: text("user_message").notNull(),
    assistantEnvelopeJsonb: jsonb("assistant_envelope_jsonb"),
    cityIntent: text("city_intent"),
    redactionClassesJsonb: jsonb("redaction_classes_jsonb").notNull().default([]),
    failureClass: text("failure_class"),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userCreatedIdx: index("copilot_conversation_turns_user_created_idx").on(
      table.userId,
      table.createdAt,
    ),
    anonCreatedIdx: index("copilot_conversation_turns_anon_created_idx").on(
      table.anonId,
      table.createdAt,
    ),
    sessionCreatedIdx: index("copilot_conversation_turns_session_created_idx").on(
      table.sessionId,
      table.createdAt,
    ),
    agentRunUnique: uniqueIndex("copilot_conversation_turns_agent_run_unique")
      .on(table.agentRunId)
      .where(sql`${table.agentRunId} is not null`),
    identityCheck: check(
      "copilot_conversation_turns_exactly_one_identity_check",
      sql`num_nonnulls(${table.userId}, ${table.anonId}) = 1`,
    ),
    statusCheck: check(
      "copilot_conversation_turns_status_check",
      sql`${table.status} in ('succeeded', 'failed')`,
    ),
    resultCheck: check(
      "copilot_conversation_turns_result_check",
      sql`(${table.status} = 'succeeded' and ${table.assistantEnvelopeJsonb} is not null and ${table.failureClass} is null) or (${table.status} = 'failed' and ${table.assistantEnvelopeJsonb} is null and ${table.failureClass} is not null)`,
    ),
    redactionClassesCheck: check(
      "copilot_conversation_turns_redaction_classes_check",
      sql`jsonb_typeof(${table.redactionClassesJsonb}) = 'array'`,
    ),
    retentionCheck: check(
      "copilot_conversation_turns_retention_check",
      sql`${table.retentionExpiresAt} > ${table.createdAt}`,
    ),
  }),
);

export const llmCallCosts = pgTable(
  "llm_call_costs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentRunId: uuid("agent_run_id").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonId: text("anon_id"),
    attemptIndex: integer("attempt_index").notNull(),
    callKind: text("call_kind").notNull().default("llm"),
    meteringUnit: text("metering_unit").notNull().default("token"),
    quantity: numeric("quantity", { precision: 20, scale: 8 }).notNull().default("0"),
    unitPricePerMillionUsd: numeric("unit_price_per_million_usd", { precision: 14, scale: 8 })
      .notNull()
      .default("0"),
    deviceCorrelationId: uuid("device_correlation_id"),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    effort: text("effort").notNull(),
    status: text("status").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull(),
    inputPricePerMillionUsd: numeric("input_price_per_million_usd", {
      precision: 14,
      scale: 8,
    }).notNull(),
    cachedInputPricePerMillionUsd: numeric("cached_input_price_per_million_usd", {
      precision: 14,
      scale: 8,
    })
      .notNull()
      .default("0"),
    outputPricePerMillionUsd: numeric("output_price_per_million_usd", {
      precision: 14,
      scale: 8,
    }).notNull(),
    costUsd: numeric("cost_usd", { precision: 14, scale: 8 }).notNull(),
    fallbackTriggered: boolean("fallback_triggered").notNull().default(false),
    latencyMs: integer("latency_ms").notNull(),
    failureClass: text("failure_class"),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    agentAttemptCallKindUnique: uniqueIndex("llm_call_costs_agent_attempt_call_kind_unique").on(
      table.agentRunId,
      table.attemptIndex,
      table.callKind,
    ),
    userCreatedIdx: index("llm_call_costs_user_created_idx").on(table.userId, table.createdAt),
    anonCreatedIdx: index("llm_call_costs_anon_created_idx").on(table.anonId, table.createdAt),
    modelCreatedIdx: index("llm_call_costs_model_created_idx").on(
      table.provider,
      table.model,
      table.createdAt,
    ),
    deviceCreatedIdx: index("llm_call_costs_device_created_idx").on(
      table.deviceCorrelationId,
      table.createdAt,
    ),
    identityCheck: check(
      "llm_call_costs_exactly_one_identity_check",
      sql`num_nonnulls(${table.userId}, ${table.anonId}) = 1`,
    ),
    attemptCheck: check("llm_call_costs_attempt_index_check", sql`${table.attemptIndex} > 0`),
    callKindCheck: check(
      "llm_call_costs_call_kind_check",
      sql`${table.callKind} in ('llm', 'stt', 'tts')`,
    ),
    meteringCheck: check(
      "llm_call_costs_metering_unit_check",
      sql`${table.meteringUnit} in ('token', 'audio_second', 'character')`,
    ),
    quantityCheck: check(
      "llm_call_costs_quantity_check",
      sql`${table.quantity} >= 0 and ${table.unitPricePerMillionUsd} >= 0`,
    ),
    effortCheck: check(
      "llm_call_costs_effort_check",
      sql`${table.effort} in ('low', 'medium', 'high')`,
    ),
    statusCheck: check(
      "llm_call_costs_status_check",
      sql`${table.status} in ('succeeded', 'failed')`,
    ),
    failureCheck: check(
      "llm_call_costs_failure_check",
      sql`(${table.status} = 'succeeded' and ${table.failureClass} is null) or (${table.status} = 'failed' and ${table.failureClass} is not null)`,
    ),
    nonnegativeCheck: check(
      "llm_call_costs_nonnegative_check",
      sql`${table.inputTokens} >= 0 and ${table.outputTokens} >= 0 and ${table.inputPricePerMillionUsd} >= 0 and ${table.outputPricePerMillionUsd} >= 0 and ${table.costUsd} >= 0 and ${table.latencyMs} >= 0`,
    ),
    cachedInputCheck: check(
      "llm_call_costs_cached_input_tokens_check",
      sql`${table.cachedInputTokens} >= 0 and ${table.cachedInputTokens} <= ${table.inputTokens}`,
    ),
    cachedInputPriceCheck: check(
      "llm_call_costs_cached_input_price_per_million_usd_check",
      sql`${table.cachedInputPricePerMillionUsd} >= 0`,
    ),
    retentionCheck: check(
      "llm_call_costs_retention_check",
      sql`${table.retentionExpiresAt} > ${table.createdAt}`,
    ),
  }),
);

export const pois = pgTable(
  "pois",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    city: text("city").notNull(),
    category: text("category").notNull(),
    nameEn: text("name_en").notNull(),
    nameZh: text("name_zh"),
    address: text("address"),
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
    sourceIds: jsonb("source_ids").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    cityCategoryIdx: index("pois_city_category_idx").on(table.city, table.category),
    categoryCheck: check(
      "pois_category_check",
      sql`${table.category} in ('food', 'attraction', 'hotel', 'shopping', 'experience')`,
    ),
  }),
);

export const poiFacts = pgTable(
  "poi_facts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poiId: uuid("poi_id")
      .notNull()
      .references(() => pois.id, { onDelete: "cascade" }),
    factType: text("fact_type").notNull(),
    valueJsonb: jsonb("value_jsonb").notNull(),
    confidence: numeric("confidence", { precision: 4, scale: 3 }).notNull(),
    source: text("source").notNull(),
    sourceClass: text("source_class"),
    sourceLocator: text("source_locator"),
    evidenceSummary: text("evidence_summary"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reviewPolicy: text("review_policy"),
    reviewedBy: uuid("reviewed_by"),
    version: integer("version").notNull().default(1),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    poiTypeIdx: index("poi_facts_poi_type_idx").on(table.poiId, table.factType),
    confidenceCheck: check(
      "poi_facts_confidence_check",
      sql`${table.confidence} >= 0 and ${table.confidence} <= 1`,
    ),
    versionCheck: check("poi_facts_version_check", sql`${table.version} > 0`),
    statusCheck: check(
      "poi_facts_status_check",
      sql`${table.status} in ('draft', 'reviewed', 'deprecated', 'rejected')`,
    ),
    sourceClassCheck: check(
      "poi_facts_source_class_check",
      sql`${table.sourceClass} is null or ${table.sourceClass} in ('official', 'operator_verified', 'reputable_editorial', 'user_report', 'model_output', 'uncorroborated_scrape')`,
    ),
    reviewedEvidenceCheck: check(
      "poi_facts_reviewed_evidence_check",
      sql`${table.status} <> 'reviewed' or (${table.sourceClass} is not null and ${table.sourceClass} in ('official', 'operator_verified', 'reputable_editorial') and ${table.sourceLocator} is not null and btrim(${table.sourceLocator}) <> '' and ${table.evidenceSummary} is not null and btrim(${table.evidenceSummary}) <> '' and char_length(${table.evidenceSummary}) <= 240 and ${table.verifiedAt} is not null and ${table.expiresAt} is not null and ${table.expiresAt} > ${table.verifiedAt} and ${table.reviewPolicy} is not null and ${table.reviewPolicy} in ('volatile-30d-v1', 'execution-90d-v1', 'stable-180d-v1') and ${table.reviewedBy} is not null)`,
    ),
    reviewPolicyAssignmentCheck: check(
      "poi_facts_review_policy_assignment_check",
      sql`${table.status} <> 'reviewed' or ${table.reviewPolicy} = case when ${table.factType} in ('booking_required', 'hours', 'payment_acceptance', 'reservation_helpful', 'ticket_availability') then 'volatile-30d-v1' when ${table.factType} = 'rainy_fit' then 'stable-180d-v1' else 'execution-90d-v1' end`,
    ),
    reviewExpiryCheck: check(
      "poi_facts_review_expiry_check",
      sql`${table.status} <> 'reviewed' or (${table.reviewPolicy} = 'volatile-30d-v1' and ${table.expiresAt} <= ${table.verifiedAt} + interval '30 days') or (${table.reviewPolicy} = 'execution-90d-v1' and ${table.expiresAt} <= ${table.verifiedAt} + interval '90 days') or (${table.reviewPolicy} = 'stable-180d-v1' and ${table.expiresAt} <= ${table.verifiedAt} + interval '180 days')`,
    ),
    localPresentationValueCheck: check(
      "poi_facts_local_presentation_value_check",
      sql`${table.factType} not in ('local_name_zh', 'local_address_zh', 'local_address_district', 'local_address_nearest_metro_exit', 'local_address_visibility_note') or coalesce((jsonb_typeof(${table.valueJsonb}) = 'object' and jsonb_typeof(${table.valueJsonb}->'text') = 'string' and btrim(${table.valueJsonb}->>'text') <> '' and char_length(btrim(${table.valueJsonb}->>'text')) <= 500), false)`,
    ),
  }),
);

// Editorial SEO copy is a private presentation layer. It does not alter POIs or facts and can be
// applied only after the shared evidence-gated candidate exists.
export const seoEditorialOverrides = pgTable(
  "seo_editorial_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poiId: uuid("poi_id")
      .notNull()
      .references(() => pois.id, { onDelete: "cascade" }),
    intent: text("intent").notNull(),
    title: text("title"),
    summary: text("summary"),
    emphasis: text("emphasis"),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => opsMemberships.userId, { onDelete: "restrict" }),
    updatedBy: uuid("updated_by")
      .notNull()
      .references(() => opsMemberships.userId, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    selectionUnique: uniqueIndex("seo_editorial_overrides_poi_intent_unique").on(
      table.poiId,
      table.intent,
    ),
    intentCheck: check(
      "seo_editorial_overrides_intent_check",
      sql`${table.intent} in ('payment', 'transport', 'ticket', 'first_timer', 'rainy_day')`,
    ),
    nonemptyCheck: check(
      "seo_editorial_overrides_nonempty_check",
      sql`${table.title} is not null or ${table.summary} is not null or ${table.emphasis} is not null`,
    ),
    titleCheck: check(
      "seo_editorial_overrides_title_check",
      sql`${table.title} is null or (btrim(${table.title}) <> '' and char_length(btrim(${table.title})) <= 140)`,
    ),
    summaryCheck: check(
      "seo_editorial_overrides_summary_check",
      sql`${table.summary} is null or (btrim(${table.summary}) <> '' and char_length(btrim(${table.summary})) <= 240)`,
    ),
    emphasisCheck: check(
      "seo_editorial_overrides_emphasis_check",
      sql`${table.emphasis} is null or (btrim(${table.emphasis}) <> '' and char_length(btrim(${table.emphasis})) <= 600)`,
    ),
  }),
);

// Editorial identity and notes never belong on the public POI-fact read model.
// Keep them in a private, one-to-one audit relation instead.
export const poiFactEditorialAudit = pgTable(
  "poi_fact_editorial_audit",
  {
    factId: uuid("fact_id")
      .primaryKey()
      .references(() => poiFacts.id, { onDelete: "cascade" }),
    collectionRowId: text("collection_row_id").notNull().unique(),
    contentDigest: text("content_digest").notNull(),
    collectionStatus: text("collection_status").notNull(),
    researcher: text("researcher").notNull(),
    reviewer: text("reviewer"),
    evidenceReviewedAt: timestamp("evidence_reviewed_at", { withTimezone: true }),
    reviewNotes: text("review_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCheck: check(
      "poi_fact_editorial_audit_collection_status_check",
      sql`${table.collectionStatus} in ('researched', 'reviewed')`,
    ),
    digestCheck: check(
      "poi_fact_editorial_audit_content_digest_check",
      sql`char_length(${table.contentDigest}) = 64`,
    ),
    reviewedFieldsCheck: check(
      "poi_fact_editorial_audit_reviewed_fields_check",
      sql`(
        ${table.collectionStatus} = 'researched'
        and ${table.reviewer} is null
        and ${table.evidenceReviewedAt} is null
      ) or (
        ${table.collectionStatus} = 'reviewed'
        and ${table.reviewer} is not null
        and ${table.evidenceReviewedAt} is not null
        and lower(${table.reviewer}) <> lower(${table.researcher})
      )`,
    ),
  }),
);

// ADR-0016 fixed expressions are private editorial records. A later server-only resolver may
// consume only reviewed, unexpired rows; this mapping deliberately exposes no browser data path.
export const safePhrases = pgTable(
  "safe_phrases",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category").notNull(),
    scene: text("scene").notNull(),
    intentKey: text("intent_key").notNull(),
    variantKey: text("variant_key").notNull(),
    severity: text("severity").notNull(),
    chineseExpression: text("chinese_expression").notNull(),
    englishIntent: text("english_intent").notNull(),
    sourceClass: text("source_class").notNull().default("operator_verified"),
    sourceLocator: text("source_locator").notNull(),
    evidenceSummary: text("evidence_summary").notNull(),
    verifiedBy: uuid("verified_by").references(() => opsMemberships.userId, {
      onDelete: "restrict",
    }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    reviewPolicy: text("review_policy"),
    status: text("status").notNull().default("draft"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    selectionIdx: uniqueIndex("safe_phrases_reviewed_selection_unique")
      .on(table.category, table.scene, table.intentKey, table.variantKey, table.severity)
      .where(sql`${table.status} = 'reviewed'`),
    categoryCheck: check(
      "safe_phrases_category_check",
      sql`${table.category} in ('allergy_dietary', 'symptoms_medical', 'emergency_help', 'passport_visa_ticket', 'destination_address')`,
    ),
    sceneCheck: check(
      "safe_phrases_scene_check",
      sql`${table.scene} in ('taxi', 'restaurant', 'venue_entry', 'hotel', 'medical', 'emergency')`,
    ),
    severityCheck: check(
      "safe_phrases_severity_check",
      sql`${table.severity} in ('standard', 'severe')`,
    ),
    keyCheck: check(
      "safe_phrases_key_check",
      sql`${table.intentKey} ~ '^[a-z0-9]+([._-][a-z0-9]+)*$' and ${table.variantKey} ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'`,
    ),
    expressionCheck: check(
      "safe_phrases_expression_check",
      sql`btrim(${table.chineseExpression}) <> '' and char_length(btrim(${table.chineseExpression})) <= 500 and btrim(${table.englishIntent}) <> '' and char_length(btrim(${table.englishIntent})) <= 500`,
    ),
    operatorSourceCheck: check(
      "safe_phrases_operator_source_check",
      sql`${table.sourceClass} = 'operator_verified'`,
    ),
    evidenceCheck: check(
      "safe_phrases_evidence_check",
      sql`btrim(${table.sourceLocator}) <> '' and char_length(btrim(${table.sourceLocator})) <= 500 and btrim(${table.evidenceSummary}) <> '' and char_length(btrim(${table.evidenceSummary})) <= 240 and ${table.evidenceSummary} !~* '[[:alnum:].+_-]+@[[:alnum:].-]+\\.[[:alpha:]]{2,}' and ${table.evidenceSummary} !~ '\\m\\+?[0-9][0-9 ()-]{6,}[0-9]\\M'`,
    ),
    statusCheck: check(
      "safe_phrases_status_check",
      sql`${table.status} in ('draft', 'reviewed', 'deprecated', 'rejected')`,
    ),
    reviewPolicyCheck: check(
      "safe_phrases_review_policy_check",
      sql`${table.reviewPolicy} is null or ${table.reviewPolicy} = 'operator-verified-90d-v1'`,
    ),
    reviewedEvidenceCheck: check(
      "safe_phrases_reviewed_evidence_check",
      sql`${table.status} <> 'reviewed' or (${table.verifiedBy} is not null and ${table.verifiedAt} is not null and ${table.expiresAt} is not null and ${table.expiresAt} > ${table.verifiedAt} and ${table.reviewPolicy} = 'operator-verified-90d-v1')`,
    ),
    reviewExpiryCheck: check(
      "safe_phrases_review_expiry_check",
      sql`${table.status} <> 'reviewed' or ${table.expiresAt} <= ${table.verifiedAt} + interval '90 days'`,
    ),
  }),
);

export const knowledgeGaps = pgTable(
  "knowledge_gaps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    questionPattern: text("question_pattern").notNull(),
    frequency: integer("frequency").notNull().default(1),
    city: text("city"),
    status: text("status").notNull().default("open"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolutionTargetJsonb: jsonb("resolution_target_jsonb"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusFrequencyIdx: index("knowledge_gaps_status_frequency_idx").on(
      table.status,
      table.frequency,
    ),
    frequencyCheck: check("knowledge_gaps_frequency_check", sql`${table.frequency} > 0`),
    statusCheck: check(
      "knowledge_gaps_status_check",
      sql`${table.status} in ('open', 'resolved', 'ignored')`,
    ),
  }),
);

export const poiCommercialLinks = pgTable(
  "poi_commercial_links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poiId: uuid("poi_id")
      .notNull()
      .references(() => pois.id, { onDelete: "cascade" }),
    partner: text("partner").notNull(),
    url: text("url").notNull(),
    disclosure: text("disclosure").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    poiStatusIdx: index("poi_commercial_links_poi_status_idx").on(table.poiId, table.status),
    statusCheck: check(
      "poi_commercial_links_status_check",
      sql`${table.status} in ('active', 'inactive')`,
    ),
  }),
);

export const partners = pgTable(
  "partners",
  {
    key: text("key").primaryKey(),
    hosts: jsonb("hosts").notNull().default([]),
    categories: jsonb("categories").notNull().default([]),
    cities: jsonb("cities").notNull().default([]),
    trackingParam: text("tracking_param").notNull(),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusIdx: index("partners_status_idx").on(table.status),
    statusCheck: check(
      "partners_status_check",
      sql`${table.status} in ('pending', 'active', 'inactive')`,
    ),
  }),
);

export const outboundClicks = pgTable(
  "outbound_clicks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    partner: text("partner")
      .notNull()
      .references(() => partners.key, { onDelete: "restrict" }),
    targetUrl: text("target_url").notNull(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonId: text("anon_id"),
    source: text("source"),
    intent: text("intent"),
    entityId: text("entity_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    partnerCreatedIdx: index("outbound_clicks_partner_created_idx").on(
      table.partner,
      table.createdAt,
    ),
    userCreatedIdx: index("outbound_clicks_user_created_idx").on(table.userId, table.createdAt),
    anonCreatedIdx: index("outbound_clicks_anon_created_idx").on(table.anonId, table.createdAt),
    identityExclusiveCheck: check(
      "outbound_clicks_identity_exclusive_check",
      sql`num_nonnulls(${table.userId}, ${table.anonId}) <= 1`,
    ),
  }),
);

export const telemetryEvents = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    anonId: text("anon_id"),
    surface: text("surface").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    intent: text("intent"),
    partner: text("partner"),
    clickId: uuid("click_id"),
    propsJsonb: jsonb("props_jsonb").notNull().default({}),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    anonCreatedIdx: index("events_anon_created_idx").on(table.anonId, table.createdAt),
    userCreatedIdx: index("events_user_created_idx").on(table.userId, table.createdAt),
    actionCreatedIdx: index("events_action_created_idx").on(table.action, table.createdAt),
    partnerCreatedIdx: index("events_partner_created_idx").on(table.partner, table.createdAt),
    clickCreatedIdx: index("events_click_created_idx").on(table.clickId, table.createdAt),
    surfaceCheck: check(
      "events_surface_check",
      sql`${table.surface} in ('web', 'mobile', 'server', 'ops')`,
    ),
    registeredActionCheck: check(
      "events_registered_action_check",
      sql`${table.action} in (
        'session_started', 'turn_completed', 'anon_limit_hit', 'rate_limited',
        'register_prompt_shown', 'fallback_triggered', 'model_failure',
        'cost_pricing_missing', 'daily_budget_exceeded', 'prompt_submitted',
        'skeleton_received', 'details_completed', 'patch_applied', 'copilot_failed',
        'human_help_suggested', 'guide_viewed', 'poi_viewed', 'scene_filter_used',
        'outbound_clicked', 'partner_redirected', 'human_help_viewed', 'task_started',
        'task_submitted', 'quote_created', 'payment_link_clicked', 'task_paid', 'task_done',
        'rescue_started', 'rescue_route_selected', 'human_help_offered',
        'human_help_confirmed', 'resolution_outcome', 'arrival_pack_generated',
        'arrival_pack_downloaded', 'arrival_pack_regenerated', 'app_opened', 'trip_opened',
        'offline_content_used', 'tool_opened', 'show_to_local_used', 'human_help_submitted'
      )`,
    ),
    propsObjectCheck: check(
      "events_props_object_check",
      sql`jsonb_typeof(${table.propsJsonb}) = 'object'`,
    ),
    copilotRetentionCheck: check(
      "events_copilot_retention_check",
      sql`${table.action} not in ('session_started', 'turn_completed', 'anon_limit_hit', 'rate_limited', 'register_prompt_shown', 'fallback_triggered', 'model_failure') or (${table.retentionExpiresAt} is not null and ${table.retentionExpiresAt} > ${table.createdAt})`,
    ),
    retentionCheck: check(
      "events_retention_check",
      sql`${table.retentionExpiresAt} > ${table.createdAt}`,
    ),
    identityCheck: check(
      "events_exactly_one_identity_check",
      sql`num_nonnulls(${table.userId}, ${table.anonId}) = 1`,
    ),
    outboundContinuityCheck: check(
      "events_outbound_continuity_check",
      sql`${table.action} not in ('outbound_clicked', 'partner_redirected') or (${table.partner} is not null and ${table.clickId} is not null)`,
    ),
  }),
);

export const humanTasks = pgTable(
  "human_tasks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonId: text("anon_id"),
    idempotencyKey: uuid("idempotency_key").notNull(),
    city: text("city").notNull(),
    kind: text("kind").notNull(),
    description: text("description").notNull(),
    contact: text("contact").notNull(),
    status: text("status").notNull().default("requested"),
    priceUsd: numeric("price_usd", { precision: 12, scale: 2 }),
    paymentLink: text("payment_link"),
    operatorNote: text("operator_note"),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    statusCreatedIdx: index("human_tasks_status_created_idx").on(table.status, table.createdAt),
    cityStatusIdx: index("human_tasks_city_status_idx").on(table.city, table.status),
    userCreatedIdx: index("human_tasks_user_created_idx").on(table.userId, table.createdAt),
    anonCreatedIdx: index("human_tasks_anon_created_idx").on(table.anonId, table.createdAt),
    idempotencyUnique: uniqueIndex("human_tasks_idempotency_key_unique").on(table.idempotencyKey),
    ownerCheck: check(
      "human_tasks_exactly_one_owner_check",
      sql`num_nonnulls(${table.userId}, ${table.anonId}) = 1`,
    ),
    anonIdCheck: check(
      "human_tasks_anon_id_format_check",
      sql`${table.anonId} is null or ${table.anonId} ~ '^[A-Za-z0-9_-]{43}$'`,
    ),
    statusCheck: check(
      "human_tasks_status_check",
      sql`${table.status} in ('requested', 'triaged', 'quoted', 'payment_pending', 'paid', 'fulfilling', 'done', 'cancelled')`,
    ),
    kindCheck: check(
      "human_tasks_kind_check",
      sql`${table.kind} in ('call_restaurant', 'ticket_help', 'translation_help', 'transport_help', 'other')`,
    ),
    priceCheck: check(
      "human_tasks_price_usd_check",
      sql`${table.priceUsd} is null or ${table.priceUsd} >= 0`,
    ),
    retentionCheck: check(
      "human_tasks_retention_terminal_check",
      sql`${table.retentionExpiresAt} is null or ${table.status} in ('done', 'cancelled')`,
    ),
  }),
);

/**
 * Private provider payment evidence. This is a ledger, not a client-readable checkout surface and
 * not a substitute for a signature-verified provider event.
 */
export const humanTaskPayments = pgTable(
  "human_task_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => humanTasks.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(),
    providerCheckoutSessionId: text("provider_checkout_session_id").notNull(),
    providerPaymentIntentId: text("provider_payment_intent_id"),
    providerEventId: text("provider_event_id"),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    checkoutUrl: text("checkout_url").notNull(),
    status: text("status").notNull().default("checkout_open"),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    taskUnique: uniqueIndex("human_task_payments_task_id_unique").on(table.taskId),
    providerCheckoutSessionUnique: uniqueIndex(
      "human_task_payments_provider_checkout_session_unique",
    ).on(table.provider, table.providerCheckoutSessionId),
    providerEventUnique: uniqueIndex("human_task_payments_provider_event_unique")
      .on(table.provider, table.providerEventId)
      .where(sql`${table.providerEventId} is not null`),
    statusCreatedIdx: index("human_task_payments_status_created_idx").on(
      table.status,
      table.createdAt,
    ),
    providerCheck: check("human_task_payments_provider_check", sql`${table.provider} = 'stripe'`),
    amountCheck: check("human_task_payments_amount_cents_check", sql`${table.amountCents} > 0`),
    currencyCheck: check("human_task_payments_currency_check", sql`${table.currency} = 'usd'`),
    checkoutUrlCheck: check(
      "human_task_payments_checkout_url_check",
      sql`${table.checkoutUrl} ~ '^https://'`,
    ),
    statusCheck: check(
      "human_task_payments_status_check",
      sql`${table.status} in ('checkout_open', 'paid', 'expired')`,
    ),
    paidEvidenceCheck: check(
      "human_task_payments_paid_evidence_check",
      sql`(
        ${table.status} = 'paid'
        and ${table.providerPaymentIntentId} is not null
        and ${table.providerEventId} is not null
        and ${table.paidAt} is not null
      ) or (
        ${table.status} <> 'paid'
        and ${table.providerPaymentIntentId} is null
        and ${table.providerEventId} is null
        and ${table.paidAt} is null
      )`,
    ),
    retentionCheck: check(
      "human_task_payments_retention_check",
      sql`${table.retentionExpiresAt} > ${table.createdAt}`,
    ),
  }),
);

export const humanTaskTransitions = pgTable(
  "human_task_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => humanTasks.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    taskCreatedIdx: index("human_task_transitions_task_created_idx").on(
      table.taskId,
      table.createdAt,
    ),
    actorCreatedIdx: index("human_task_transitions_actor_created_idx").on(
      table.actorId,
      table.createdAt,
    ),
    fromStatusCheck: check(
      "human_task_transitions_from_status_check",
      sql`${table.fromStatus} in ('requested', 'triaged', 'quoted', 'payment_pending', 'paid', 'fulfilling', 'done', 'cancelled')`,
    ),
    toStatusCheck: check(
      "human_task_transitions_to_status_check",
      sql`${table.toStatus} in ('requested', 'triaged', 'quoted', 'payment_pending', 'paid', 'fulfilling', 'done', 'cancelled')`,
    ),
    statusChangeCheck: check(
      "human_task_transitions_status_change_check",
      sql`${table.fromStatus} <> ${table.toStatus}`,
    ),
    reasonLengthCheck: check(
      "human_task_transitions_reason_length_check",
      sql`char_length(btrim(${table.reason})) between 10 and 500`,
    ),
  }),
);

export const humanTaskEvidence = pgTable(
  "human_task_evidence",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => humanTasks.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    redactionClassesJsonb: jsonb("redaction_classes_jsonb").notNull().default([]),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    taskCreatedIdx: index("human_task_evidence_task_created_idx").on(table.taskId, table.createdAt),
    kindCheck: check(
      "human_task_evidence_kind_check",
      sql`${table.kind} in ('outcome', 'transcript_excerpt')`,
    ),
    contentLengthCheck: check(
      "human_task_evidence_content_length_check",
      sql`char_length(btrim(${table.content})) between 10 and 4000`,
    ),
    redactionClassesCheck: check(
      "human_task_evidence_redaction_classes_check",
      sql`jsonb_typeof(${table.redactionClassesJsonb}) = 'array'`,
    ),
  }),
);

export const visePodDeviceBindings = pgTable(
  "visepod_device_bindings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    deviceId: text("device_id").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    state: text("state").notNull().default("active"),
    boundAt: timestamp("bound_at", { withTimezone: true }).notNull().defaultNow(),
    boundBy: uuid("bound_by")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    deviceActiveUnique: uniqueIndex("visepod_device_bindings_device_active_unique")
      .on(table.deviceId)
      .where(sql`${table.state} = 'active'`),
    deviceHistoryIdx: index("visepod_device_bindings_device_bound_at_idx").on(
      table.deviceId,
      table.boundAt,
    ),
    userHistoryIdx: index("visepod_device_bindings_user_bound_at_idx").on(
      table.userId,
      table.boundAt,
    ),
    deviceIdCheck: check(
      "visepod_device_bindings_device_id_check",
      sql`${table.deviceId} ~ '^[A-Za-z0-9._~\\-]{1,64}$'`,
    ),
    stateCheck: check(
      "visepod_device_bindings_state_check",
      sql`${table.state} in ('active', 'revoked')`,
    ),
    revokedStateCheck: check(
      "visepod_device_bindings_revoked_state_check",
      sql`(${table.state} = 'active' and ${table.revokedAt} is null and ${table.revokedBy} is null)
        or (${table.state} = 'revoked' and ${table.revokedAt} is not null and ${table.revokedBy} is not null)`,
    ),
  }),
);

export const visePodBindingIdempotency = pgTable(
  "visepod_binding_idempotency",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    idempotencyKey: uuid("idempotency_key").notNull(),
    bindingId: uuid("binding_id")
      .notNull()
      .references(() => visePodDeviceBindings.id, { onDelete: "cascade" }),
    commandDigest: text("command_digest").notNull(),
    responseJsonb: jsonb("response_jsonb").notNull(),
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    idempotencyKeyUnique: uniqueIndex("visepod_binding_idempotency_key_unique").on(
      table.idempotencyKey,
    ),
    bindingCreatedIdx: index("visepod_binding_idempotency_binding_created_idx").on(
      table.bindingId,
      table.createdAt,
    ),
    digestCheck: check(
      "visepod_binding_idempotency_command_digest_check",
      sql`${table.commandDigest} ~ '^[a-f0-9]{64}$'`,
    ),
    retentionCheck: check(
      "visepod_binding_idempotency_retention_check",
      sql`${table.retentionExpiresAt} > ${table.createdAt}`,
    ),
  }),
);

export const visePodProvisioningGrants = pgTable(
  "visepod_provisioning_grants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenDigest: text("token_digest").notNull(),
    opsUserId: uuid("ops_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "restrict" }),
    scope: text("scope").notNull().default("visepod.provision"),
    environment: text("environment").notNull(),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    revokedBy: uuid("revoked_by").references(() => authUsers.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tokenDigestUnique: uniqueIndex("visepod_provisioning_grants_token_digest_unique").on(
      table.tokenDigest,
    ),
    activeGrantIdx: index("visepod_provisioning_grants_active_grant_idx").on(
      table.tokenDigest,
      table.environment,
      table.expiresAt,
    ),
    tokenDigestCheck: check(
      "visepod_provisioning_grants_token_digest_check",
      sql`${table.tokenDigest} ~ '^[a-f0-9]{64}$'`,
    ),
    scopeCheck: check(
      "visepod_provisioning_grants_scope_check",
      sql`${table.scope} = 'visepod.provision'`,
    ),
    environmentCheck: check(
      "visepod_provisioning_grants_environment_check",
      sql`${table.environment} in ('development', 'production')`,
    ),
    lifetimeCheck: check(
      "visepod_provisioning_grants_lifetime_check",
      sql`${table.expiresAt} = ${table.issuedAt} + interval '8 hours'`,
    ),
  }),
);

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  agentRuns: many(agentRuns),
  events: many(telemetryEvents),
  humanTasks: many(humanTasks),
  visePodDeviceBindings: many(visePodDeviceBindings),
}));

export const tripsRelations = relations(trips, ({ one, many }) => ({
  user: one(users, {
    fields: [trips.owner],
    references: [users.id],
  }),
  events: many(tripEvents),
  agentRuns: many(agentRuns),
  completionJobs: many(copilotCompletionJobs),
}));

export const tripEventsRelations = relations(tripEvents, ({ one }) => ({
  trip: one(trips, {
    fields: [tripEvents.tripId],
    references: [trips.id],
  }),
}));

export const copilotCompletionJobsRelations = relations(copilotCompletionJobs, ({ one }) => ({
  trip: one(trips, {
    fields: [copilotCompletionJobs.tripId],
    references: [trips.id],
  }),
}));

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  user: one(users, {
    fields: [agentRuns.userId],
    references: [users.id],
  }),
  trip: one(trips, {
    fields: [agentRuns.tripId],
    references: [trips.id],
  }),
  toolCalls: many(toolCalls),
}));

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  agentRun: one(agentRuns, {
    fields: [toolCalls.agentRunId],
    references: [agentRuns.id],
  }),
}));

export const poisRelations = relations(pois, ({ many }) => ({
  facts: many(poiFacts),
  commercialLinks: many(poiCommercialLinks),
}));

export const poiFactsRelations = relations(poiFacts, ({ one }) => ({
  poi: one(pois, {
    fields: [poiFacts.poiId],
    references: [pois.id],
  }),
}));

export const poiCommercialLinksRelations = relations(poiCommercialLinks, ({ one }) => ({
  poi: one(pois, {
    fields: [poiCommercialLinks.poiId],
    references: [pois.id],
  }),
}));

export const partnersRelations = relations(partners, ({ many }) => ({
  outboundClicks: many(outboundClicks),
}));

export const outboundClicksRelations = relations(outboundClicks, ({ one }) => ({
  partnerConfig: one(partners, {
    fields: [outboundClicks.partner],
    references: [partners.key],
  }),
}));

export const telemetryEventsRelations = relations(telemetryEvents, ({ one }) => ({
  user: one(users, {
    fields: [telemetryEvents.userId],
    references: [users.id],
  }),
}));

export const humanTasksRelations = relations(humanTasks, ({ one, many }) => ({
  user: one(users, {
    fields: [humanTasks.userId],
    references: [users.id],
  }),
  transitions: many(humanTaskTransitions),
  evidence: many(humanTaskEvidence),
}));

export const humanTaskTransitionsRelations = relations(humanTaskTransitions, ({ one }) => ({
  task: one(humanTasks, {
    fields: [humanTaskTransitions.taskId],
    references: [humanTasks.id],
  }),
}));

export const humanTaskEvidenceRelations = relations(humanTaskEvidence, ({ one }) => ({
  task: one(humanTasks, {
    fields: [humanTaskEvidence.taskId],
    references: [humanTasks.id],
  }),
}));

export const visePodDeviceBindingsRelations = relations(visePodDeviceBindings, ({ one, many }) => ({
  user: one(users, {
    fields: [visePodDeviceBindings.userId],
    references: [users.id],
  }),
  idempotencyRecords: many(visePodBindingIdempotency),
}));

export const visePodBindingIdempotencyRelations = relations(
  visePodBindingIdempotency,
  ({ one }) => ({
    binding: one(visePodDeviceBindings, {
      fields: [visePodBindingIdempotency.bindingId],
      references: [visePodDeviceBindings.id],
    }),
  }),
);
