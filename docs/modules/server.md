# Server Module

Path: `apps/server`

## Responsibility

The server package is the modular monolith. It owns request validation, business orchestration,
service interfaces, persistence adapters, and the root tRPC router. During Phase 0 it is imported by
Next.js runtimes rather than deployed as an independent service.

## Root Router

`apps/server/src/router.ts` composes:

- `copilot`: route, retrieve, generate, validate, apply Trip actions, and two-pass completion.
- `trip`: create/read/save/claim/share operations through a TripService.
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
- Identity is accepted from request input in current code; verified server session context is a P0
  release requirement.
- The package exports router types and selected service factories, but does not itself expose an HTTP
  listener.

## Hard Boundaries

- AI output must parse as a Copilot envelope before any action is applied.
- Trip persistence receives an already validated Trip plus the patch evidence.
- A module may not import another module's tables.
- Production configuration may not silently select an in-memory adapter.
- Public request identity must eventually come only from verified session context.
- P0-03 introduces the shared `RequestIdentity` context for verified Supabase sessions or signed
  anonymous sessions. P0-04 remains responsible for consuming it on every Trip owner route.
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
