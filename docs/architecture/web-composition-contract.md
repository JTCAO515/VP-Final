# Shared Web Composition Contract

Status: frozen v1
Owner: Server / Web runtime
Issue: [#554](https://github.com/JTCAO515/VP-Final/issues/554)
Authority: `@visepanda/app-server/web-composition`

## Purpose

The shared Web composition boundary creates the in-process services used by the current `apps/web`
and planned `apps/web-v3` Next.js route adapters. It centralizes runtime-mode parsing, adapter
selection, per-process durable connection reuse, explicit local-demo memory, test injection, optional
provider/rate/queue availability, and truthful missing-capability errors. It is not an HTTP API,
client package, datastore, or second server.

## Frozen Interface

| Element | Contract |
| --- | --- |
| Owner | `apps/server/src/webComposition.ts`, exported only as `@visepanda/app-server/web-composition` |
| Inputs | allowlisted environment record; optional server-derived `RequestIdentity`; optional deferred-task scheduler; test-only injected `WebServerServices` |
| Outputs | `createWebServerServices`, `getServerCaller`, bounded capability getters, completion callback runtime, and the `WebServerServices` type |
| Errors | `WebRuntimeUnavailableError` with stable public-safe reason classes; missing optional capabilities remain `undefined` until a getter requires them |
| Idempotency / lifecycle | one process-cached local-demo service set and one process-cached durable service set; explicit test services are injected/cleared; durable state remains in Postgres, not process memory |
| Authorization | unchanged server router/service ownership; identity remains server-derived by the thin Next route; composition does not grant a role or accept browser-selected ownership |
| Version | frozen v1 under ADR-0005 and ADR-0025; breaking output, error, mode, cache, identity, or adapter changes require a separate contract review |
| Consumers | `apps/web/src/app/api/_server.ts` and `apps/web-v3/src/app/api/_server.ts`, both thin re-export adapters |

## Invariants

- `test` requires explicit injected services; no implicit fixture exists.
- `local-demo` is the only runtime that may select non-durable memory without `DATABASE_URL`.
- `preview`, `staging`, and `production` require the durable database adapter and fail closed when a
  required setting is absent or invalid.
- The boundary keeps existing environment variable names, adapter factories, retention checks,
  provider diagnostics, limiter/queue availability, deferred observability behavior, and public error
  semantics unchanged.
- Consumers MUST NOT import `apps/server/src/webComposition.ts` or another app's adapter by path.
- A V3 route MUST reuse this subpath; it must not copy the composition, proxy raw traveler data to
  the current Production Web, or create a process-local deployed fallback.
- This contract does not authorize a V3 API route. #555 owns the first Early Access route consumer.

## Compatibility Evidence

```bash
pnpm --filter @visepanda/app-server typecheck
pnpm --filter @visepanda/app-server build
pnpm --filter @visepanda/app-web typecheck
pnpm --filter @visepanda/app-web test
pnpm --filter @visepanda/app-web build
pnpm --filter @visepanda/app-web-v3 typecheck
pnpm --filter @visepanda/app-web-v3 test
pnpm --filter @visepanda/app-web-v3 build
```

The old Web suite is the consumer-compatibility baseline. The V3 consumer additionally proves
missing mode, missing durable database, explicit test injection, and labelled local-demo behavior.
Database contracts remain the durable adapter authority.

## Rollback

Revert the ownership move and package subpath, restore the prior `apps/web` implementation, and keep
V3 without a real API route. No migration, data rewrite, provider setting, or external deployment is
part of this contract.
