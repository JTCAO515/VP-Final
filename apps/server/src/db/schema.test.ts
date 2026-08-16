import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  agentRuns,
  authUsers,
  copilotCompletionJobs,
  copilotConversationTurns,
  creatorReferrals,
  humanTaskTransitions,
  humanTaskEvidence,
  humanTaskPayments,
  humanTasks,
  knowledgeImportBatches,
  knowledgeGaps,
  llmCallCosts,
  outboundClicks,
  opsAuditEvents,
  opsMemberships,
  partners,
  poiCommercialLinks,
  poiFactEditorialAudit,
  poiFacts,
  pois,
  readinessAssessments,
  safePhrases,
  telemetryEvents,
  toolCalls,
  tripEvents,
  trips,
  users,
  visePodBindingIdempotency,
  visePodDeviceBindings,
  visePodProvisioningGrants,
} from "./schema.js";

describe("database schema", () => {
  it("maps the v1 auth/trip tables", () => {
    expect(users.id.name).toBe("id");
    expect(trips.owner.name).toBe("owner");
    expect(trips.anonId.name).toBe("anon_id");
    expect(trips.shareToken.name).toBe("share_token");
    expect(tripEvents.tripId.name).toBe("trip_id");
    expect(tripEvents.completionJobId.name).toBe("completion_job_id");
    expect(tripEvents.completionAttempt.name).toBe("completion_attempt");
    expect(getTableConfig(trips).checks.map((constraint) => constraint.name)).toContain(
      "trips_exactly_one_owner_check",
    );
    expect(getTableConfig(tripEvents).checks.map((constraint) => constraint.name)).toContain(
      "trip_events_completion_provenance_check",
    );
    expect(getTableConfig(tripEvents).indexes.map((index) => index.config.name)).toContain(
      "trip_events_completion_job_attempt_unique",
    );
  });

  it("maps the agent trace tables", () => {
    expect(agentRuns.userId.name).toBe("user_id");
    expect(agentRuns.anonId.name).toBe("anon_id");
    expect(agentRuns.inputDigest.name).toBe("input_digest");
    expect(agentRuns.latencyMs.name).toBe("latency_ms");
    expect(agentRuns.expiresAt.name).toBe("expires_at");
    expect(agentRuns.costUsd.name).toBe("cost_usd");
    expect(getTableConfig(agentRuns).checks.map((constraint) => constraint.name)).toContain(
      "agent_runs_at_most_one_identity_check",
    );
    expect(toolCalls.agentRunId.name).toBe("agent_run_id");
    expect(toolCalls.toolName.name).toBe("tool_name");
    expect(toolCalls.inputDigest.name).toBe("input_digest");
  });

  it("maps private Copilot conversation and per-attempt cost records", () => {
    expect(copilotConversationTurns.userMessage.name).toBe("user_message");
    expect(copilotConversationTurns.assistantEnvelopeJsonb.name).toBe("assistant_envelope_jsonb");
    expect(copilotConversationTurns.retentionExpiresAt.name).toBe("retention_expires_at");
    expect(
      getTableConfig(copilotConversationTurns).checks.map((constraint) => constraint.name),
    ).toContain("copilot_conversation_turns_exactly_one_identity_check");
    expect(llmCallCosts.inputPricePerMillionUsd.name).toBe("input_price_per_million_usd");
    expect(llmCallCosts.cachedInputTokens.name).toBe("cached_input_tokens");
    expect(llmCallCosts.cachedInputPricePerMillionUsd.name).toBe(
      "cached_input_price_per_million_usd",
    );
    expect(llmCallCosts.fallbackTriggered.name).toBe("fallback_triggered");
    expect(getTableConfig(llmCallCosts).checks.map((constraint) => constraint.name)).toContain(
      "llm_call_costs_cached_input_tokens_check",
    );
    expect(getTableConfig(llmCallCosts).checks.map((constraint) => constraint.name)).toContain(
      "llm_call_costs_cached_input_price_per_million_usd_check",
    );
    expect(getTableConfig(llmCallCosts).indexes.map((index) => index.config.name)).toContain(
      "llm_call_costs_agent_attempt_call_kind_unique",
    );
    expect(llmCallCosts.callKind.name).toBe("call_kind");
    expect(llmCallCosts.meteringUnit.name).toBe("metering_unit");
    expect(llmCallCosts.deviceCorrelationId.name).toBe("device_correlation_id");
    expect(getTableConfig(llmCallCosts).foreignKeys).toHaveLength(1);
  });

  it("maps server-only completion job records", () => {
    expect(copilotCompletionJobs.tripId.name).toBe("trip_id");
    expect(copilotCompletionJobs.baseVersion.name).toBe("base_version");
    expect(copilotCompletionJobs.idempotencyKey.name).toBe("idempotency_key");
    expect(
      getTableConfig(copilotCompletionJobs).checks.map((constraint) => constraint.name),
    ).toContain("copilot_completion_jobs_state_check");
  });

  it("maps consented Readiness records with bounded retention", () => {
    expect(readinessAssessments.assessmentJsonb.name).toBe("assessment_jsonb");
    expect(readinessAssessments.resultJsonb.name).toBe("result_jsonb");
    expect(readinessAssessments.retentionExpiresAt.name).toBe("retention_expires_at");
    expect(
      getTableConfig(readinessAssessments).checks.map((constraint) => constraint.name),
    ).toContain("readiness_assessments_user_or_trip_check");
    expect(
      getTableConfig(readinessAssessments).checks.map((constraint) => constraint.name),
    ).toContain("readiness_assessments_retention_check");
  });

  it("maps the Ops authorization and audit tables", () => {
    expect(authUsers.id.name).toBe("id");
    expect(authUsers.email.name).toBe("email");
    expect(opsMemberships.userId.name).toBe("user_id");
    expect(opsMemberships.role.name).toBe("role");
    expect(opsMemberships.revokedAt.name).toBe("revoked_at");
    expect(opsMemberships.revokedBy.name).toBe("revoked_by");
    expect(opsAuditEvents.actorId.name).toBe("actor_id");
    expect(opsAuditEvents.metadataJsonb.name).toBe("metadata_jsonb");
    expect(humanTaskEvidence.actorId.name).toBe("actor_id");
    expect(getTableConfig(humanTaskEvidence).foreignKeys).toHaveLength(2);
  });

  it("maps the knowledge tables", () => {
    expect(pois.nameEn.name).toBe("name_en");
    expect(poiFacts.factType.name).toBe("fact_type");
    expect(poiFacts.status.name).toBe("status");
    expect(poiFacts.reviewPolicy.name).toBe("review_policy");
    expect(poiFacts.reviewedBy.name).toBe("reviewed_by");
    expect(poiFacts.status.default).toBe("draft");
    expect(poiFactEditorialAudit.collectionRowId.name).toBe("collection_row_id");
    expect(poiFactEditorialAudit.contentDigest.name).toBe("content_digest");
    expect(knowledgeImportBatches.id.name).toBe("id");
    expect(poiFactEditorialAudit.importBatchId.name).toBe("import_batch_id");
    expect(
      getTableConfig(poiFactEditorialAudit).indexes.map((index) => index.config.name),
    ).toContain("poi_fact_editorial_audit_import_batch_idx");
    expect(
      getTableConfig(poiFactEditorialAudit).checks.map((constraint) => constraint.name),
    ).toContain("poi_fact_editorial_audit_reviewed_fields_check");
    expect(getTableConfig(poiFacts).checks.map((constraint) => constraint.name)).toContain(
      "poi_facts_status_check",
    );
    expect(getTableConfig(poiFacts).checks.map((constraint) => constraint.name)).toContain(
      "poi_facts_reviewed_evidence_check",
    );
    expect(getTableConfig(poiFacts).checks.map((constraint) => constraint.name)).toContain(
      "poi_facts_review_expiry_check",
    );
    expect(getTableConfig(poiFacts).checks.map((constraint) => constraint.name)).toContain(
      "poi_facts_local_presentation_value_check",
    );
    expect(knowledgeGaps.questionPattern.name).toBe("question_pattern");
    expect(knowledgeGaps.resolvedAt.name).toBe("resolved_at");
    expect(poiCommercialLinks.poiId.name).toBe("poi_id");
  });

  it("maps private fixed-expression provenance without traveler ownership", () => {
    expect(safePhrases.category.name).toBe("category");
    expect(safePhrases.chineseExpression.name).toBe("chinese_expression");
    expect(safePhrases.verifiedBy.name).toBe("verified_by");
    expect(safePhrases.expiresAt.name).toBe("expires_at");
    expect(safePhrases.status.default).toBe("draft");
    expect(getTableConfig(safePhrases).indexes.map((index) => index.config.name)).toContain(
      "safe_phrases_reviewed_selection_unique",
    );
    expect(getTableConfig(safePhrases).checks.map((constraint) => constraint.name)).toContain(
      "safe_phrases_reviewed_evidence_check",
    );
    expect(getTableConfig(safePhrases).checks.map((constraint) => constraint.name)).toContain(
      "safe_phrases_evidence_check",
    );
    expect(Object.keys(safePhrases)).not.toContain("userId");
    expect(Object.keys(safePhrases)).not.toContain("anonId");
  });

  it("maps private VisePod binding history and bounded idempotency records", () => {
    expect(visePodDeviceBindings.deviceId.name).toBe("device_id");
    expect(visePodDeviceBindings.userId.name).toBe("user_id");
    expect(visePodDeviceBindings.boundBy.name).toBe("bound_by");
    expect(visePodDeviceBindings.revokedAt.name).toBe("revoked_at");
    expect(
      getTableConfig(visePodDeviceBindings).indexes.map((index) => index.config.name),
    ).toContain("visepod_device_bindings_device_active_unique");
    expect(
      getTableConfig(visePodDeviceBindings).checks.map((constraint) => constraint.name),
    ).toContain("visepod_device_bindings_revoked_state_check");
    expect(visePodBindingIdempotency.idempotencyKey.name).toBe("idempotency_key");
    expect(visePodBindingIdempotency.commandDigest.name).toBe("command_digest");
    expect(visePodBindingIdempotency.retentionExpiresAt.name).toBe("retention_expires_at");
    expect(
      getTableConfig(visePodBindingIdempotency).indexes.map((index) => index.config.name),
    ).toContain("visepod_binding_idempotency_key_unique");
    expect(Object.keys(visePodDeviceBindings)).not.toContain("token");
    expect(Object.keys(visePodDeviceBindings)).not.toContain("deviceSecret");
    expect(Object.keys(visePodBindingIdempotency)).not.toContain("commandJsonb");
  });

  it("maps private VisePod provisioning grants without raw token storage", () => {
    expect(visePodProvisioningGrants.tokenDigest.name).toBe("token_digest");
    expect(visePodProvisioningGrants.opsUserId.name).toBe("ops_user_id");
    expect(visePodProvisioningGrants.scope.default).toBe("visepod.provision");
    expect(
      getTableConfig(visePodProvisioningGrants).indexes.map((index) => index.config.name),
    ).toContain("visepod_provisioning_grants_token_digest_unique");
    expect(Object.keys(visePodProvisioningGrants)).not.toContain("token");
  });

  it("maps the outbound commerce tables", () => {
    expect(partners.trackingParam.name).toBe("tracking_param");
    expect(partners.kind.name).toBe("kind");
    expect(getTableConfig(partners).checks.map((constraint) => constraint.name)).toContain(
      "partners_kind_check",
    );
    expect(creatorReferrals.partnerKey.name).toBe("partner_key");
    expect(creatorReferrals.landingPath.name).toBe("landing_path");
    expect(getTableConfig(creatorReferrals).checks.map((constraint) => constraint.name)).toContain(
      "creator_referrals_landing_path_check",
    );
    expect(outboundClicks.targetUrl.name).toBe("target_url");
    expect(outboundClicks.userId.name).toBe("user_id");
    expect(outboundClicks.anonId.name).toBe("anon_id");
    expect(getTableConfig(outboundClicks).checks.map((constraint) => constraint.name)).toContain(
      "outbound_clicks_identity_exclusive_check",
    );
  });

  it("maps the telemetry events table", () => {
    expect(telemetryEvents.anonId.name).toBe("anon_id");
    expect(telemetryEvents.propsJsonb.name).toBe("props_jsonb");
    expect(telemetryEvents.retentionExpiresAt.name).toBe("retention_expires_at");
    expect(getTableConfig(telemetryEvents).checks.map((constraint) => constraint.name)).toContain(
      "events_copilot_retention_check",
    );
    expect(getTableConfig(telemetryEvents).checks.map((constraint) => constraint.name)).toContain(
      "events_exactly_one_identity_check",
    );
    expect(getTableConfig(telemetryEvents).checks.map((constraint) => constraint.name)).toContain(
      "events_registered_action_check",
    );
    expect(getTableConfig(telemetryEvents).checks.map((constraint) => constraint.name)).toContain(
      "events_outbound_continuity_check",
    );
    expect(getTableConfig(telemetryEvents).indexes.map((index) => index.config.name)).toContain(
      "events_click_created_idx",
    );
  });

  it("maps the private Human Task ownership and lifecycle fields", () => {
    expect(humanTasks.status.name).toBe("status");
    expect(humanTasks.anonId.name).toBe("anon_id");
    expect(humanTasks.idempotencyKey.name).toBe("idempotency_key");
    expect(humanTasks.priceUsd.name).toBe("price_usd");
    expect(humanTasks.paymentLink.name).toBe("payment_link");
    expect(humanTasks.retentionExpiresAt.name).toBe("retention_expires_at");
    expect(getTableConfig(humanTasks).checks.map((constraint) => constraint.name)).toContain(
      "human_tasks_exactly_one_owner_check",
    );
    expect(getTableConfig(humanTasks).indexes.map((index) => index.config.name)).toContain(
      "human_tasks_idempotency_key_unique",
    );
    expect(humanTaskTransitions.actorId.name).toBe("actor_id");
    expect(humanTaskTransitions.reason.name).toBe("reason");
    expect(
      getTableConfig(humanTaskTransitions).checks.map((constraint) => constraint.name),
    ).toContain("human_task_transitions_reason_length_check");
    expect(humanTaskPayments.providerCheckoutSessionId.name).toBe("provider_checkout_session_id");
    expect(humanTaskPayments.amountCents.name).toBe("amount_cents");
    expect(humanTaskPayments.providerEventId.name).toBe("provider_event_id");
    expect(getTableConfig(humanTaskPayments).checks.map((constraint) => constraint.name)).toContain(
      "human_task_payments_paid_evidence_check",
    );
    expect(getTableConfig(humanTaskPayments).indexes.map((index) => index.config.name)).toContain(
      "human_task_payments_provider_checkout_session_unique",
    );
  });
});
