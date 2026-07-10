# ADR-0005: Explicit runtime modes and production adapter ownership

Date: 2026-07-11
Status: Accepted
Deciders: JTCao (operator) / architecture owner
Owner: JTCao (operator and architecture owner)
Review date: before P0-06 (#115) merges, and no later than 2026-08-11

## Context and Observed Deviation

The repository deliberately contains deterministic fixtures, in-memory services, and partial Postgres
adapters. Web caller construction can select memory-backed Trip and knowledge services when
`DATABASE_URL` is absent. That is valid only for explicit tests or a labelled local demo. It is a D2
durability and truthfulness risk if preview, staging, or production silently presents memory state as
real persistence.

## Decision

### Explicit modes

| Mode | Selection | Durable owner | Fixture/memory rule | User-facing result |
| --- | --- | --- | --- | --- |
| `test` | explicit factory/injection | fixture or ephemeral test DB | allowed only by direct injection | never deployed |
| `local-demo` | `VISEPANDA_RUNTIME_MODE=local-demo` | none unless local DB configured | allowed and persistently labelled | `Demo mode`; no live claims |
| `preview` | explicit preview deployment config | configured preview Postgres service | forbidden as fallback | ready, degraded, or unavailable |
| `staging` | explicit named staging config | staging Postgres service | forbidden | ready, degraded, or unavailable |
| `production` | explicit named production config | production Postgres service | forbidden | ready, degraded, or unavailable |

Missing configuration, transient database/provider failure, or cold start MUST NOT select `local-demo`
or an in-memory adapter in preview, staging, or production.

### Single production ownership

| Object | Production owner | Forbidden production path |
| --- | --- | --- |
| Trip and Trip events | `apps/server` Trip service + Postgres adapter | Web/local process state or direct UI write |
| Human Tasks | `apps/server` task service + Postgres adapter | app-local or seeded process ledger |
| Outbound clicks/partner configuration | `apps/server` commerce service + Postgres adapter | in-memory ledger or raw partner redirect |
| Telemetry | `apps/server` telemetry service + Postgres adapter | per-route memory/event array |
| Agent traces/tool calls | `apps/server` trace service + Postgres adapter | provider-log-only production record |
| Knowledge facts/gaps | `apps/server` knowledge service + Postgres adapter | browser-owned or unreviewed fixture store |

P0-06 (#115) owns the mode resolver, adapter inventory, and migration of consumers. Routers call the
owning service interface; no second production write path is permitted.

### Truthful health contract

- `ready`: all dependencies required by the requested capability are configured and reachable.
- `degraded`: an optional capability is unavailable and the API/UI states the limitation.
- `unavailable`: a required dependency is absent/failing; API returns typed non-success and UI does not
  fabricate results.
- Health reports dependency class (database, identity, AI, telemetry, outbound, payment) but never
  secrets, tokens, cookie values, or personal data.

### Fixture isolation and startup

- Fixtures/memory require explicit `test` injection or `local-demo`; they are never the default deployed
  path.
- Local demo displays a persistent label and cannot claim live booking scarcity, payment completion,
  partner confirmation, or Human Help fulfillment.
- Startup/health validates required configuration. Missing dependency means degraded/unavailable, never
  successful mock output or a claimed durable write.
- Adapter selection is observable by adapter name only; test factories inject their adapters directly.

## Frozen Consequences

P0-06 implements the matrix and durable adapter inventory. P0-10 persists generation only through its
owner. P0-11 removes misleading demo/dead UI states. P0-20 implements health, error, rate/budget, and
observability behavior consistent with this ADR.

## Required Verification

P0-06/P0-10/P0-11/P0-20 must test explicit test/demo injection, missing `DATABASE_URL`, unavailable
provider, cold-start-like re-instantiation, no memory selection in deployed modes, demo labelling,
typed degraded/unavailable responses, and secret-safe health/log output.

## Alternatives Rejected

- Fallback to memory after DB/provider failure: loses data and fabricates success.
- Infer demo from missing environment: turns misconfiguration into a misleading user mode.
- Per-route adapter selection: creates divergent ownership and unauditable writes.

## Observation and Rollback

This contract may make formerly permissive deployed paths honestly unavailable until configured. Observe
degraded/unavailable rate, startup failures, adapter selection, and accidental demo exposure. Any
contradictory implementation evidence is D2 and requires ADR amendment/supersession. Rollback disables
the capability honestly or rolls forward to a verified durable adapter; it MUST NOT restore silent
production memory fallback.
