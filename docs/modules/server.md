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

`identity` and `commerce` directories reserve domain boundaries but are not complete production
modules yet.

## Service and Adapter Pattern

- Routers validate transport input and call services.
- Service interfaces are defined inside their owning module.
- `src/db` contains Drizzle adapters for implemented durable paths.
- In-memory services support tests and explicit demos only.
- Runtime dependencies are injected through `ServerContext` or a caller factory.

## Current State

- Trip and knowledge have in-memory and Postgres adapters.
- Copilot has a deterministic default router, stub retrieval, deterministic envelope generation, and
  deterministic day completion.
- Task and telemetry routers currently instantiate in-memory services.
- Trip and Copilot routers accept identity only from `ServerContext`; owner fields and replacement
  snapshots are not transport inputs.
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
state.

## Hard Boundaries

- AI output must parse as a Copilot envelope before any action is applied.
- Existing Trip persistence receives only a validated Patch plus trusted identity, expected version,
  and event source; creation receives the initial validated Trip.
- A module may not import another module's tables.
- Production configuration may not silently select an in-memory adapter.
- Public request identity comes only from verified session context or the signed anonymous cookie.
- P0-03 introduces the shared `RequestIdentity` context for verified Supabase sessions or signed
  anonymous sessions. P0-04 consumes it on every Trip owner route.
- [ADR-0005](../adr/ADR-0005-runtime-modes-and-production-adapter-ownership.md) freezes explicit modes, single durable production owners, and the prohibition on implicit production memory fallback.
- [ADR-0004](../adr/ADR-0004-identity-trip-ownership-security.md) freezes the target identity,
  owner, share, claim, and optimistic-concurrency contract for P0-03/P0-04.

## Verification

```bash
pnpm --filter @visepanda/app-server typecheck
pnpm --filter @visepanda/app-server test
pnpm --filter @visepanda/app-server build
```

Security-sensitive changes also require database or API-level ownership tests.
