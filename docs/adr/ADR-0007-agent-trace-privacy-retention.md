# ADR-0007: Agent Trace Privacy and Retention

Date: 2026-07-12
Status: Accepted
Deciders: JTCao (operator) / architecture owner
Owner: security / platform
Review date: 2026-10-10, or before any trace replay/export surface ships

## Context

P0-09 makes AI-run and tool metadata durable so provider cost, latency, fallback, validation, and
failure evidence can be investigated. A trace may be linked to a verified account or server-issued
anonymous session, so it is operational personal data even when no direct identifier is displayed.
The former schema could store unconstrained input/output JSON and raw errors. That conflicts with the
project's data-minimization rule and had no retention behavior.

## Decision

`agent_runs` and `tool_calls` are server-only operational metadata. They may contain only the
allowlisted fields below.

| Class | Allowed | Forbidden |
| --- | --- | --- |
| Identity | one verified `user_id`, one signed `anon_id`, or neither | client-supplied identity, both identities on one run, email, cookie/token value |
| Run | intent, status, bounded token counts, estimated USD cost, latency, validation/repair outcome, normalized failure class | raw prompt, response body, full model error, secrets, credentials, payment/contact narrative |
| Provider attempt | provider, model, status, bounded counts/cost/latency, normalized failure | request/response payload or provider credential |
| Tool call | tool name, status, input/output digests, latency, normalized failure | tool payload, location/contact/payment narrative, raw error |

Input/output digests are SHA-256 correlation values, not anonymization and not a user-visible replay
format. They are never used for authorization. Raw legacy JSON/error columns remain only for
additive compatibility; the migration redacts existing values and runtime adapters always leave them
empty.

Each run receives `expires_at = created_at + 30 days`. The server-only
`internal.purge_expired_agent_traces()` routine deletes expired runs and cascading tool calls.
Platform runs it daily after OA-004 configures the production database; until that external evidence
exists, no deployment may claim trace retention enforcement has been observed in production.

Trace write failure is non-blocking: it can never turn a validated Copilot result into a fabricated
failure or alter Trip state. Conversely, failure to trace is operationally visible only through
server-safe logging/monitoring added by later observability work; it must not emit raw user content.

## Consequences

- P0-09 owns the additive migration, Postgres adapter, redaction tests, and private trace write path.
- P0-07 supplies real provider attempts; P0-08 supplies retrieval/tool evidence; neither may store
  raw model or tool payloads.
- Trace rows are not exposed through Supabase Data API or public Trip sharing. A future Ops query or
  export surface needs an explicit authorization and privacy review.
- OA-004 verification must include daily purge scheduling and an expired-row deletion observation
  before a production retention claim is made.

## Rollback

Disable trace injection or the affected durable runtime capability honestly. Do not re-enable raw
payload recording. A retention correction uses an append-only migration and immediate server-only
purge, not an edit to this decision or a rewrite of migration history.
