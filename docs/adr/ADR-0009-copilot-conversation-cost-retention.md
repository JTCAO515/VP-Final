# ADR-0009: Copilot Conversation and Cost Retention

Date: 2026-07-19
Status: Accepted
Deciders: JTCao (operator) / architecture owner through Issue #185 and #248
Owner: security / data platform
Review date: 2026-08-19, or before public Copilot data export ships

## Context

DEMO-01c requires durable records for product learning and model-cost reconciliation. Existing Agent
Trace deliberately stores only digests and bounded operational metadata under ADR-0007, so it cannot
also serve as a customer-conversation archive. The existing `events` table is durable but does not
freeze Copilot action names or retention. Collecting redacted conversation text is a new personal-data
class and therefore requires deletion, retention, access, and export rules before runtime collection.

## Decision

Three records are distinct and remain independently queryable:

1. `copilot_conversation_turns` stores one redacted user message and either one validated, redacted
   Copilot envelope or a normalized failure class. It carries exactly one server-derived user or
   anonymous identity, an opaque application session UUID, an optional Agent Trace reference, a
   bounded city intent, redaction-class labels, and a required expiry.
2. `llm_call_costs` stores one row per provider attempt. Each row snapshots provider, configured model
   id, effort, token counts, input/output unit prices, computed USD cost, fallback state, latency,
   normalized failure, identity, and required expiry. It never stores prompts or provider payloads.
3. The existing `events` table remains the product-event ledger. The seven frozen Copilot actions are
   `session_started`, `turn_completed`, `anon_limit_hit`, `rate_limited`,
   `register_prompt_shown`, `fallback_triggered`, and `model_failure`. New rows for these actions
   require an explicit retention deadline. Events require at least one trusted user or anonymous
   identity; both may coexist briefly to preserve login attribution, but neither may be fabricated.

The runtime owner must set `VISEPANDA_COPILOT_RECORD_RETENTION_DAYS`; the accepted default and maximum
for the controlled demo are 30 days. Database rows intentionally have no time-based default: a writer
that forgets the configured deadline fails instead of creating indefinite retention. Changing the
maximum is a privacy decision, not an ordinary environment tweak.

Both new tables, their aggregate views, and their purge routine are server-only. `anon` and
`authenticated` receive no direct access. Internal aggregate views expose cost, volume, and fallback
metrics, never message or envelope content. Provider keys, authorization values, raw cookies,
signatures, and raw provider errors are forbidden at the domain and runtime write boundary.

Authenticated account deletion cascades the user's conversation and cost rows. Anonymous and current
authenticated rows expire through `internal.purge_expired_copilot_observability()`. The production
schedule is an OA-004 operator action and must be observed before retention enforcement is claimed.
The controlled demo has no self-service conversation export; before broader public launch, privacy
copy and an owner-authorized export/deletion runbook must describe the applicable data-subject process.

Trace persistence and conversation/cost/event persistence are non-blocking relative to the validated
Copilot response. A write failure must be surfaced through safe operational evidence, but it cannot
replace a real answer with fake success or leak the rejected payload into logs.

## Consequences

- #248 first lands Zod, Drizzle, migration, RLS, purge, and sanitized view contracts. A later direct
  main-based PR wires non-blocking runtime writers after this schema is reviewed.
- Existing Agent Trace privacy remains unchanged; raw content is not added to `agent_runs` or
  `attempts_jsonb`.
- Unit-price snapshots make each attempt reconcilable without relying on a mutable provider price
  catalog.
- Thirty-day raw records are sufficient for the controlled demo. Longer-lived sanitized aggregates
  require a separate retention decision and are not implied by these views.

## Rollback

Disable the runtime writer while preserving honest Copilot behavior. Purge newly collected rows with
the restricted routine if the privacy boundary fails. Repair schema or access defects through a new
forward migration; never weaken ADR-0007 or rewrite migration history.
