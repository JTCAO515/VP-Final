import { relations } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const opsMemberships = pgTable("ops_memberships", {
  userId: uuid("user_id").primaryKey(),
  role: text("role").notNull(),
  createdBy: uuid("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const opsAuditEvents = pgTable(
  "ops_audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    actorId: uuid("actor_id").notNull(),
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
    agentRunId: uuid("agent_run_id")
      .notNull()
      .references(() => agentRuns.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    anonId: text("anon_id"),
    attemptIndex: integer("attempt_index").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    effort: text("effort").notNull(),
    status: text("status").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    inputPricePerMillionUsd: numeric("input_price_per_million_usd", {
      precision: 14,
      scale: 8,
    }).notNull(),
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
    agentAttemptUnique: uniqueIndex("llm_call_costs_agent_attempt_unique").on(
      table.agentRunId,
      table.attemptIndex,
    ),
    userCreatedIdx: index("llm_call_costs_user_created_idx").on(table.userId, table.createdAt),
    anonCreatedIdx: index("llm_call_costs_anon_created_idx").on(table.anonId, table.createdAt),
    modelCreatedIdx: index("llm_call_costs_model_created_idx").on(
      table.provider,
      table.model,
      table.createdAt,
    ),
    identityCheck: check(
      "llm_call_costs_exactly_one_identity_check",
      sql`num_nonnulls(${table.userId}, ${table.anonId}) = 1`,
    ),
    attemptCheck: check("llm_call_costs_attempt_index_check", sql`${table.attemptIndex} > 0`),
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
    retentionExpiresAt: timestamp("retention_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    anonCreatedIdx: index("events_anon_created_idx").on(table.anonId, table.createdAt),
    actionCreatedIdx: index("events_action_created_idx").on(table.action, table.createdAt),
    surfaceCheck: check(
      "events_surface_check",
      sql`${table.surface} in ('web', 'mobile', 'server', 'ops')`,
    ),
    copilotRetentionCheck: check(
      "events_copilot_retention_check",
      sql`${table.action} not in ('session_started', 'turn_completed', 'anon_limit_hit', 'rate_limited', 'register_prompt_shown', 'fallback_triggered', 'model_failure') or (${table.retentionExpiresAt} is not null and ${table.retentionExpiresAt} > ${table.createdAt})`,
    ),
    identityCheck: check(
      "events_at_least_one_identity_check",
      sql`num_nonnulls(${table.userId}, ${table.anonId}) >= 1`,
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

export const humanTaskTransitions = pgTable(
  "human_task_transitions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => humanTasks.id, { onDelete: "cascade" }),
    fromStatus: text("from_status").notNull(),
    toStatus: text("to_status").notNull(),
    actorId: uuid("actor_id").notNull(),
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

export const usersRelations = relations(users, ({ many }) => ({
  trips: many(trips),
  agentRuns: many(agentRuns),
  events: many(telemetryEvents),
  humanTasks: many(humanTasks),
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
}));

export const humanTaskTransitionsRelations = relations(humanTaskTransitions, ({ one }) => ({
  task: one(humanTasks, {
    fields: [humanTaskTransitions.taskId],
    references: [humanTasks.id],
  }),
}));
