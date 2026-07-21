# Data Platform Module

Path: `infra/supabase`

## Responsibility

Supabase Postgres is the durable system of record for identity, Trips, knowledge, AI traces,
commercial evidence, Human Tasks, and telemetry. Repository migrations are the schema history.

## Current Schema Areas

| Area              | Relations                                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------- |
| Identity and Trip | `users`, `trips`, `trip_events`, `copilot_completion_jobs`                                |
| AI trace          | `agent_runs`, `tool_calls`, `llm_call_costs`                                              |
| Copilot dialogue  | `copilot_conversation_turns`                                                              |
| Knowledge         | `pois`, `poi_facts`, `poi_fact_editorial_audit`, `knowledge_gaps`, `poi_commercial_links` |
| Commerce          | `partners`, `outbound_clicks`                                                             |
| Telemetry         | `events`, `trust_funnel_daily` materialized aggregate                                     |
| Human operations  | `human_tasks`, `human_task_transitions`, `human_task_evidence`                            |
| Ops authorization | `ops_memberships`, `ops_audit_events`                                                     |

## Migration Rules

- Migrations are ordered, append-only SQL files.
- Generate a migration with `supabase migration new <name> --workdir infra`.
- Never edit a migration that has landed on a shared branch or environment.
- Bundle grants and RLS with the table or with an immediate security migration.
- Public schema objects require explicit exposure decisions.
- Views and materialized views used only for operations belong in a non-exposed schema.
- Drizzle schema mappings must stay aligned with the migrated shape.

## Access Model

- Public POI reads and eligible fact reads may be exposed through explicit grants plus RLS. A fact is
  eligible only when its lifecycle status is `reviewed`, its typed source class is independently
  reviewable, its source locator and bounded evidence summary are present, its verification time is
  real and not in the future, and it is not expired. `created_at` is ingestion time, not verification.
  Legacy rows lacking typed evidence are retained as `draft`; a migration MUST NOT infer evidence from
  their old `source` string or promote them without review.
- Traveler-owned data requires verified identity and owner policies.
- Trip rows require one exclusive authenticated or signed-anonymous owner. Owner-scoped conditional
  writes and event append occur in one transaction; public share tokens are revocable read-only
  capabilities. See [ADR-0004](../adr/ADR-0004-identity-trip-ownership-security.md).
- Partner config, outbound clicks, telemetry, Human Tasks, and internal aggregates are server-only.
- `poi_fact_editorial_audit` is server-only: it retains a bulk collection row id, deterministic
  content digest, researcher/reviewer handles, actual evidence-review time, and internal review notes.
  RLS is enabled and no `anon` or `authenticated` grant exists. It must not be joined into any public
  POI, Explore, Copilot, or SEO response.
- A Human Task has exactly one authenticated or signed-anonymous owner and a globally unique UUID
  idempotency key. Direct `anon` and `authenticated` Data API reads are revoked. The initial status is
  `requested`. Status updates follow the database-guarded canonical edge map and the server writes an
  append-only `human_task_transitions` row containing authenticated Ops actor, from/to state, reason,
  and timestamp in the same transaction. Both relations deny direct Data API access. A restricted
  `internal.purge_expired_human_tasks()` routine removes terminal rows after their explicit retention
  deadline; P0-14 assigns the 90-day deadline on an enabled terminal transition. Production purge
  scheduling remains an operator action and is not claimed as active.
- P0-15 uses the existing private `operator_note` column. Each note write and a minimized
  `human_task.note.updated` Ops audit event commit in one transaction; the audit records actor, task
  id, timestamp, and note-presence only, never note or contact content.
- P0-16 stores pre-sanitized, append-only `human_task_evidence` only for unexpired `done` or
  `cancelled` tasks. Direct traveler roles have no privilege. Evidence is deleted with its task by
  the 90-day purge/account cascade; direct row updates/deletes are rejected while the task exists,
  actor deletion is restricted while evidence remains, and API reads stop at expiry even before the
  purge runs. Audit rows contain ids/kind only, never evidence content.
- Ops users access data through protected server routes, not broad direct table grants.
- Ops membership and audit tables are server-only with RLS enabled and no `anon` or `authenticated`
  Data API grants. Supabase Auth proves identity; `ops_memberships` independently grants authority.
- Service-role and database credentials never enter a public client.

P0-09 extends `agent_runs` with exclusive verified-user/signed-anonymous identity, provider/model,
token/cost/latency, validation/repair, normalized failure, and `expires_at` metadata. `tool_calls`
stores only tool metadata and digests. Both relations are server-only, redact legacy raw payload
columns during migration, and are retained for 30 days under [ADR-0007](../adr/ADR-0007-agent-trace-privacy-retention.md).
The `internal.purge_expired_agent_traces()` routine is restricted from Data API roles; daily production
scheduling remains part of OA-004 verification and is not yet claimed as deployed evidence.

DEMO-01c adds server-only `copilot_conversation_turns` and normalized `llm_call_costs`. Both require
exactly one trusted identity and an explicit future retention deadline; direct Data API access is
revoked. Conversations contain only pre-redacted text and a validated pre-redacted envelope. Cost rows
snapshot prices and tokens per provider attempt. The cost ledger preserves total input tokens plus a
cached-input subset and separate cache-miss/cache-hit price snapshots; cached tokens may never exceed
total input tokens. A `cost_pricing_missing` event requires the same explicit future retention as
other Copilot events. The runtime writer commits each turn and its N cost attempts with the Agent Run
in one transaction. It copies provider-reported usage and the fixed-point price/cost snapshot; absent
usage is zero rather than estimated. The default retention windows are conversation 180 days, cost
400 days, and event 180 days, with separate positive-integer server env overrides. Internal views
expose only aggregate cost, volume, and fallback metrics. The eight Copilot product-event actions
require an explicit event expiry.
The cost table currently has a non-null cascading Agent Run foreign key while Agent Runs expire after
30 days. This conflicts with the intended 400-day cost deadline and remains an explicit #248 D2
architecture blocker; production must not claim 400-day reconciliation retention until a forward
contract resolves the parent/child lifecycle without silently weakening ADR-0007 or #250.
Events accept an authenticated identity without requiring a fabricated anonymous id, while still
rejecting rows with no trusted identity.
All three record classes use the restricted `internal.purge_expired_copilot_observability()` routine
under [ADR-0009](../adr/ADR-0009-copilot-conversation-cost-retention.md).

P0-04b migration `20260711001932_exclusive_trip_owner.sql` converts any legacy dual-owner row to its
authenticated owner, then replaces the previous at-least-one check with
`num_nonnulls(owner, anon_id) = 1`. The versioned Postgres adapter scopes every private query by the
exclusive owner. Existing Trip Patch updates condition on `head_version`; the snapshot update and one
matching event append execute in the same transaction. Claim updates only anonymous rows, while
share creation locks the owned row to avoid returning competing capability tokens.

The adapter and migration are implemented, but OA-004 remains open until an approved Supabase
environment is configured and replayed. Local replay requires Docker Desktop; CI's pinned Supabase
CLI database-contract job runs reset, pgTAP ownership checks, the adapter integration suite
(including concurrent bulk-import replay and Explore visibility), and security advisors.

P0-13 migration `20260716110000_durable_human_task_ownership.sql` deliberately aborts if an environment
contains ownerless pre-P0-13 rows. Such rows require an operator-approved ownership/removal decision;
the migration never deletes them or invents an owner. Empty and verified environments migrate normally.

P0-14 migration `20260716170000_human_task_transitions.sql` adds private append-only transition
evidence and a database trigger that rejects non-canonical status edges even for privileged server
writes. The actor references verified `auth.users`; deletion is restricted while evidence remains,
while task deletion cascades its transition history to honor task retention/account deletion.

P0-05 adds a non-hierarchical `operator` / `editor` / `admin` membership table and append-only Ops
audit evidence. The migration references verified `auth.users` ids, denies direct client access, and
requires OA-010 for the first Admin bootstrap. Runtime code contains no default administrator.

P0-10 starts with a server-only `copilot_completion_jobs` contract. One row is unique per
`trip_id`/`base_version` and separately by idempotency key, so at-least-once queue delivery cannot
create multiple completion effects for the same accepted skeleton. The table contains no prompt,
provider payload, credential, or replacement Trip snapshot. It has RLS enabled and no direct
Data API grants; a later owner-scoped server status endpoint and authenticated worker will consume it.
`trip_events.completion_job_id` and `completion_attempt` are nullable, server-only provenance. They
must be present together on an `ai_copilot` event, and one job attempt can append at most one event.
This lets a partial retry prove whether the current Trip head was advanced by the same job instead of
guessing from version offsets or block ids.

P1-01a extends `poi_facts` with nullable `source_class`, `source_locator`, and `evidence_summary`, and
makes `verified_at` nullable for honest drafts. The accepted six-city collection columns
`source_class`, `source_locator`, `evidence_summary`, `confidence`, `verified_at`, and `expires_at`
map directly; ingestion time is generated by Postgres `created_at`. The legacy `source` column remains
only for compatibility and never grants public eligibility.

| Six-city collection column               | Durable/domain field                            | Import behavior                                                            |
| ---------------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------------- |
| `source_class`                           | `source_class` / `sourceClass`                  | Typed enum; no inference from legacy source                                |
| `source_locator`                         | `source_locator` / `sourceLocator`              | Preserved stable URL or internal evidence reference                        |
| `evidence_summary`                       | `evidence_summary` / `evidenceSummary`          | Trimmed, maximum 240 characters, rejects email/phone PII                   |
| `confidence`                             | `confidence`                                    | Preserved numeric value from 0 through 1                                   |
| `fact_status`                            | `status`                                        | Imported collection records always remain `draft`                          |
| `verified_at`                            | `poi_fact_editorial_audit.evidence_reviewed_at` | Preserved only when supplied by an independent reviewer; never synthesized |
| `expires_at`                             | `expires_at` / `expiresAt`                      | Nullable and preserved                                                     |
| `review_policy`                          | derived during review / `reviewPolicy`          | Public-safe versioned cadence; null while draft                            |
| `researcher`, `reviewer`, `review_notes` | `poi_fact_editorial_audit`                      | Private provenance only; never projected into public fact reads            |
| import operation time                    | `created_at` / `ingestedAt`                     | Generated by Postgres, separate from review evidence                       |

## Verification

Follow the [Supabase migration runbook](../runbooks/supabase-migrations.md): replay from an empty local
database, run pgTAP contracts, run security advisors, inspect migration history, and record evidence.

Database changes are not complete when SQL merely parses. The relevant role must be tested for both
allowed and denied operations.
