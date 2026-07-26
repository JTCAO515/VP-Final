# ADR-0011: Database-local Retention Purge Scheduling

Date: 2026-07-26
Status: Accepted
Deciders: architecture owner through Issue #311
Owner: security / data platform
Review date: 2026-08-26, or after the first production purge incident

## Context

ADR-0007, ADR-0009, ADR-0010, and the Human Task lifecycle freeze explicit retention deadlines.
Production already stores those deadlines and exposes restricted purge functions, but the 2026-07-26
OA-004 read-only audit found no scheduler: `pg_cron` and `pg_net` were absent and `cron.job` did not
exist. Expired rows were filtered from current views while remaining physically retained. That is a D2
privacy and lifecycle deviation because the product promise and actual deletion behavior differ.

The scheduler must run without public credentials, preserve the existing 30/90/180/400-day decisions,
leave bounded evidence of deletion counts, and make consecutive failures observable. It must not turn
retention into an external webhook dependency or expose row content.

## Decision

Use Supabase Cron / `pg_cron` inside the same Postgres database.

- Enable `pg_cron` through an append-only migration after Tier B review.
- Run the three existing restricted purge functions as three staggered daily jobs at 02:10, 02:20, and
  02:30 UTC. Separate jobs prevent one data class from blocking the others and keep run evidence
  attributable.
- Route every job through `internal.run_retention_purge(target)`. The wrapper records only target,
  timestamps, normalized success/failure, non-negative deletion counts, and a five-character SQLSTATE.
  It never records deleted content, identity, raw SQL errors, credentials, cookies, or signatures.
- Catch a purge failure inside a subtransaction, roll back that purge, and retain a normalized failed
  audit row. An audit-write failure remains visible in `cron.job_run_details`.
- Expose `internal.retention_purge_health` as a private queryable control surface. It marks targets
  with no recent run, a latest failure, or more than 26 hours since completion, and reports failures
  since the latest success.
- Keep the scheduler, audit table, health view, and wrapper unavailable to `anon` and
  `authenticated`. Production verification is performed through approved privileged read-only
  tooling and never through the public Data API.

## Alternatives considered

### Vercel Cron or QStash calling a protected endpoint

Rejected for this boundary. It adds an HTTP endpoint, signing secret, network dependency, deployment
coupling, and another failure mode to a database-local deletion operation. QStash remains appropriate
for durable Copilot completion work, not for enforcing database retention.

### One job calling all purge functions

Rejected because an early failure could prevent later data classes from running and would make
per-target health less clear.

### Filtering expired rows without physical deletion

Rejected. It hides expired data from views but does not satisfy the accepted retention promise.

## Consequences

- Local and CI Supabase stacks must support `pg_cron`; database-contract tests verify the extension,
  job definitions, permissions, deletion behavior, audit shape, and health semantics.
- Production remains non-compliant until the reviewed migration is applied and at least one run for
  each target is observed. Repository merge alone is not production evidence.
- Supabase Cron records job history in `cron.job_run_details`; the private VisePanda audit adds
  deletion counts and normalized per-target health.
- No retention duration changes. Any future change to schedule cadence, data class, or deletion
  semantics requires a forward migration and ADR review.

## Rollback

Pause the three jobs with `cron.unschedule` or the Supabase Cron UI while preserving the private
audit history and existing purge functions. Forward-repair a faulty wrapper or schedule. Do not drop
retention deadlines, rewrite migration history, or replace physical deletion with view filtering.
