# Data Platform Module

Path: `infra/supabase`

## Responsibility

Supabase Postgres is the durable system of record for identity, Trips, knowledge, AI traces,
commercial evidence, Human Tasks, and telemetry. Repository migrations are the schema history.

## Current Schema Areas

| Area              | Relations                                                     |
| ----------------- | ------------------------------------------------------------- |
| Identity and Trip | `users`, `trips`, `trip_events`                               |
| AI trace          | `agent_runs`, `tool_calls`                                    |
| Knowledge         | `pois`, `poi_facts`, `knowledge_gaps`, `poi_commercial_links` |
| Commerce          | `partners`, `outbound_clicks`                                 |
| Telemetry         | `events`, `trust_funnel_daily` materialized aggregate         |
| Human operations  | `human_tasks`                                                 |

## Migration Rules

- Migrations are ordered, append-only SQL files.
- Generate a migration with `supabase migration new <name> --workdir infra`.
- Never edit a migration that has landed on a shared branch or environment.
- Bundle grants and RLS with the table or with an immediate security migration.
- Public schema objects require explicit exposure decisions.
- Views and materialized views used only for operations belong in a non-exposed schema.
- Drizzle schema mappings must stay aligned with the migrated shape.

## Access Model

- Public POI and current fact reads may be exposed through explicit grants plus RLS.
- Traveler-owned data requires verified identity and owner policies.
- Trip rows require one exclusive authenticated or signed-anonymous owner. Owner-scoped conditional
  writes and event append occur in one transaction; public share tokens are revocable read-only
  capabilities. See [ADR-0004](../adr/ADR-0004-identity-trip-ownership-security.md).
- Partner config, outbound clicks, telemetry, Human Tasks, and internal aggregates are server-only.
- Ops users access data through protected server routes, not broad direct table grants.
- Service-role and database credentials never enter a public client.

P0-04b migration `20260711001932_exclusive_trip_owner.sql` converts any legacy dual-owner row to its
authenticated owner, then replaces the previous at-least-one check with
`num_nonnulls(owner, anon_id) = 1`. The versioned Postgres adapter scopes every private query by the
exclusive owner. Existing Trip Patch updates condition on `head_version`; the snapshot update and one
matching event append execute in the same transaction. Claim updates only anonymous rows, while
share creation locks the owned row to avoid returning competing capability tokens.

The adapter and migration are implemented, but OA-004 remains open until an approved Supabase
environment is configured and replayed. Local replay requires Docker Desktop; CI's pinned Supabase
CLI database-contract job runs reset, pgTAP ownership checks, the adapter integration suite, and
security advisors.

## Verification

Follow the [Supabase migration runbook](../runbooks/supabase-migrations.md): replay from an empty local
database, run pgTAP contracts, run security advisors, inspect migration history, and record evidence.

Database changes are not complete when SQL merely parses. The relevant role must be tested for both
allowed and denied operations.
