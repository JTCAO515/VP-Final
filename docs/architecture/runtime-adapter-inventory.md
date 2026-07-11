# Runtime Mode and Adapter Inventory

Status: active

This is the canonical implementation inventory for ADR-0005 and P0-06. It records ownership and
selection boundaries; it does not claim that every future adapter is implemented or externally
configured.

## Explicit Mode Contract

| Mode | Selection | Memory | Database result without `DATABASE_URL` |
| --- | --- | --- | --- |
| `test` | Explicit factory input | Explicitly injected only | Unavailable until an adapter is injected |
| `local-demo` | `VISEPANDA_RUNTIME_MODE=local-demo` | Allowed and labelled `Demo mode` | Degraded `memory-demo` |
| `preview` | `VISEPANDA_RUNTIME_MODE=preview` | Forbidden | Unavailable |
| `staging` | `VISEPANDA_RUNTIME_MODE=staging` | Forbidden | Unavailable |
| `production` | `VISEPANDA_RUNTIME_MODE=production` | Forbidden | Unavailable |

An absent or invalid `VISEPANDA_RUNTIME_MODE` is unavailable. Code MUST NOT infer demo mode from
`NODE_ENV`, `VERCEL_ENV`, a missing secret, a cold start, or a transient provider/database failure.
The resolver reports only mode, dependency class, status, error code, and adapter name; it never
returns connection strings or credentials.

## Persistent Object Inventory

| Object | Production owner | Current durable state | Forbidden production path | Canonical follow-up |
| --- | --- | --- | --- | --- |
| Trip and Trip events | Server Trip service + Postgres adapter | Implemented; Web durable composition implemented | Web/process-local state | #113, P0-06c #176 |
| Knowledge facts/gaps | Server Knowledge service + Postgres adapter | Web composition implemented; Ops convergence follows | Browser/Ops process store | P0-06c #176, P0-06d #175 |
| Ops authorization/audit | Server Ops Authorization service + Postgres adapter | Implemented | Client role, email allowlist, default admin | #114 |
| Human Tasks | Server Human Task service + Postgres adapter | Not implemented for production | App-local task ledger | P0-13 #150 |
| Outbound clicks/partners | Server Commerce service + Postgres adapter | Not implemented for production | Memory click ledger/raw redirect | P0-18 #155 |
| Telemetry | Server Telemetry service + Postgres adapter | Not implemented for production | Per-route event array | P0-19 #156 |
| Agent traces/tool calls | Server Trace service + Postgres adapter | Not implemented for production | Provider-log-only record | P0-09 #73 |

P0-06 does not steal the later business workflows. Until their canonical Issue lands, a deployed
route that would accept those writes must be unavailable rather than acknowledge a process-memory
write.

## Composition Sequence

1. Resolve the explicit runtime mode.
2. Resolve capability availability before the request uses a service.
3. Select the adapter exactly once at the application composition boundary.
4. Inject the selected service into routers.
5. On adapter failure, keep the same selection and return an honest typed error.

The resolver and `requireService` guard live at `@visepanda/app-server/runtime`. P0-06b removed
router-local fallback construction. P0-06c migrated the Web composition root and P0-06d owns the
remaining Ops migration; neither duplicates mode parsing.

## Verification

```bash
pnpm --filter @visepanda/app-server test -- src/runtime/runtimeMode.test.ts
pnpm --filter @visepanda/app-server test -- src/runtime/requireService.test.ts
pnpm --filter @visepanda/app-server typecheck
pnpm --filter @visepanda/app-server lint
```

Production readiness additionally requires OA-004 (`DATABASE_URL`) and OA-005
(`VISEPANDA_RUNTIME_MODE` plus provider configuration) to be verified in the target environment.
