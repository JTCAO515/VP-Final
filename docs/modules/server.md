# Server Module

Path: `apps/server`

## Responsibility

The server package is the modular monolith. It owns request validation, business orchestration,
service interfaces, persistence adapters, and the root tRPC router. During Phase 0 it is imported by
Next.js runtimes rather than deployed as an independent service.

## Root Router

`apps/server/src/router.ts` composes:

- `copilot`: route, retrieve, generate, validate, apply Trip actions, and two-pass completion.
- `trip`: owner-scoped create/read/Patch/claim/share/revoke operations through the versioned Trip service.
- `knowledge`: POI/fact/gap reads and operations workflow.
- `task`: Human Task creation and updates.
- `telemetry`: event validation and ingestion interface.
- `trace`: private agent-run and tool-call metadata recording.

`identity` and `commerce` directories reserve domain boundaries but are not complete production
modules yet.

## Service and Adapter Pattern

- Routers validate transport input and call services.
- Service interfaces are defined inside their owning module.
- `src/db` contains Drizzle adapters for implemented durable paths.
- In-memory services support tests and explicit demos only.
- Runtime dependencies are injected through `ServerContext` or a caller factory.
- `@visepanda/app-server/runtime` owns explicit mode parsing, database capability metadata, and the
  persistent-object ownership inventory. It does not select a service inside a router.

## Current State

- Trip, knowledge, and agent trace have in-memory and Postgres adapters. Trace records use one trusted
  authenticated identity, one signed anonymous identity, or neither; they persist only digests and
  allowlisted operational metadata. Provider/tool payloads and raw errors are excluded.
- Copilot retains deterministic defaults only in explicit tests and `local-demo`. In any other runtime,
  DEMO-01 injects the v3 provider route executor, records safe attempts through Trace, performs bounded
  JSON candidate repair before Zod validation, normalizes a provider string `message` into the typed
  Copilot message object, forwards provider-specific compatibility body fields from the AI inventory,
  and fails with a typed configuration-unavailable error when a required route lacks a trusted model
  name or credential.
- The deployed DEMO-01 path is dialogue-only. It rejects Trip actions, tools, commerce, Human Help,
  and citations before any state-changing branch can run. Real provider evidence remains blocked on
  OA-005 and is not claimed by this repository change.
- Knowledge, Human Task, and Telemetry routers require a service selected by the composition root;
  omitted capabilities return typed `SERVICE_UNAVAILABLE` and never construct memory internally.
- The runtime resolver and router injection boundary are implemented and tested, but Web/Ops
  composition migration remains in P0-06c and P0-06d. Therefore no deployed durable-path claim is
  made yet.
- Trip and Copilot routers accept identity only from `ServerContext`; owner fields and replacement
  snapshots are not transport inputs.
- P0-10 freezes a server-only completion-job contract before connecting a durable queue. Job rows are
  uniquely keyed by accepted Trip/base version and idempotency key; no worker may mutate a Trip except
  through the existing owner/version-scoped Patch service. A completion Patch carries optional
  server-only job/attempt provenance into its Trip event; normal traveler and Copilot events remain
  unchanged.
- The package exports router types and selected service factories, but does not itself expose an HTTP
  listener.

## Versioned Trip Contract

P0-04a freezes `VersionedTripService` as the sole Trip service authority. Its
private methods require a trusted `TripIdentity`; reads return `{ trip, version }`; existing writes
accept only a deterministic `TripPatch` plus `expectedVersion`. Non-owners receive a non-enumerating
missing result. A stale write from the confirmed owner raises `TRIP_VERSION_CONFLICT` with only the
safe current version, and an empty Patch changes neither snapshot, event count, nor version.

The in-memory implementation is the executable reference for owner, claim, share/revoke, and conflict
semantics. `createDbVersionedTripService` implements the same contract with owner-scoped queries,
conditional version updates, transactional event append, atomic claim, and locked share creation.
P0-04c (#168) switches routers, Copilot workers, and Web consumers to this contract and removes the
legacy snapshot-saving service and adapter. The Copilot first pass creates or applies a validated
Patch, while silent completion applies one owner/version-scoped Patch and cannot overwrite newer
state. The linked completion job/attempt is unique in `trip_events`, giving a retry a durable way to
distinguish its own previous partial effect from a later unrelated Trip edit.

## Hard Boundaries

- AI output must parse as a Copilot envelope before any action is applied.
- Knowledge-backed Copilot retrieval selects only eligible reviewed facts, carries bounded evidence
  metadata, and rejects citations outside the fetched allowlist. The durable fact service creates
  unverified `draft` facts, demotes edited facts back to draft, and promotes only complete independently
  reviewable evidence through an explicit review/renewal transition. Public RLS mirrors the same
  source-class/evidence/verification/expiry boundary. Gap persistence normalizes email and phone-like
  substrings before storing a question pattern.
- Existing Trip persistence receives only a validated Patch plus trusted identity, expected version,
  and event source; creation receives the initial validated Trip.
- A module may not import another module's tables.
- Production configuration may not silently select an in-memory adapter.
- Routers MUST NOT import a memory service factory or select an adapter. Tests and composition roots
  inject services explicitly; an omitted optional capability fails closed.
- Public request identity comes only from verified session context or the signed anonymous cookie.
- P0-03 introduces the shared `RequestIdentity` context for verified Supabase sessions or signed
  anonymous sessions. P0-04 consumes it on every Trip owner route.
- [ADR-0005](../adr/ADR-0005-runtime-modes-and-production-adapter-ownership.md) freezes explicit modes, single durable production owners, and the prohibition on implicit production memory fallback.
- [ADR-0004](../adr/ADR-0004-identity-trip-ownership-security.md) freezes the target identity,
  owner, share, claim, and optimistic-concurrency contract for P0-03/P0-04.
- [ADR-0007](../adr/ADR-0007-agent-trace-privacy-retention.md) freezes trace minimization, restricted
  retention, and non-blocking trace persistence. Real provider attempt production data remains P0-07.

## Verification

```bash
pnpm --filter @visepanda/app-server typecheck
pnpm --filter @visepanda/app-server test
pnpm --filter @visepanda/app-server build
```

Security-sensitive changes also require database or API-level ownership tests.
