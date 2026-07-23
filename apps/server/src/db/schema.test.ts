import { describe, expect, it } from "vitest";
import { getTableConfig } from "drizzle-orm/pg-core";
import {
  agentRuns,
  authUsers,
  copilotCompletionJobs,
  copilotConversationTurns,
  humanTaskTransitions,
  humanTaskEvidence,
  humanTasks,
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
  telemetryEvents,
  toolCalls,
  tripEvents,
  trips,
  users,
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
      "llm_call_costs_agent_attempt_unique",
    );
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

  it("maps the Ops authorization and audit tables", () => {
    expect(authUsers.id.name).toBe("id");
    expect(opsMemberships.userId.name).toBe("user_id");
    expect(opsMemberships.role.name).toBe("role");
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
    expect(knowledgeGaps.questionPattern.name).toBe("question_pattern");
    expect(knowledgeGaps.resolvedAt.name).toBe("resolved_at");
    expect(poiCommercialLinks.poiId.name).toBe("poi_id");
  });

  it("maps the outbound commerce tables", () => {
    expect(partners.trackingParam.name).toBe("tracking_param");
    expect(outboundClicks.targetUrl.name).toBe("target_url");
  });

  it("maps the telemetry events table", () => {
    expect(telemetryEvents.anonId.name).toBe("anon_id");
    expect(telemetryEvents.propsJsonb.name).toBe("props_jsonb");
    expect(telemetryEvents.retentionExpiresAt.name).toBe("retention_expires_at");
    expect(getTableConfig(telemetryEvents).checks.map((constraint) => constraint.name)).toContain(
      "events_copilot_retention_check",
    );
    expect(getTableConfig(telemetryEvents).checks.map((constraint) => constraint.name)).toContain(
      "events_at_least_one_identity_check",
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
  });
});
