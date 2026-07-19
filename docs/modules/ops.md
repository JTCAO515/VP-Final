# Ops Module

Path: `apps/ops`

## Responsibility

The Ops Next.js application is an internal operations surface for execution facts, knowledge gaps,
Human Tasks, partner configuration, and later reconciliation. It must be deployed separately from
the public Web application and protected by server-side role checks.

## Current Routes

- `/facts`: list, create, update, renew, and deprecate execution facts.
- `/gaps`: inspect and resolve knowledge gaps.
- `/tasks`: inspect the durable Human Task intake queue.
- `/api/knowledge/*`: server-side knowledge operations.
- `/api/tasks`: permission-protected task list endpoint.
- `/api/tasks/:taskId/status`: `task.write`-protected transition endpoint; actor is session-derived.
- `/login`: verified Supabase Ops sign-in.
- `/roles` and `/api/roles`: Admin-only membership management.

## Current State

- Knowledge follows the explicit runtime resolver: deployed modes require the Postgres adapter,
  tests inject memory, and only `local-demo` may use labelled process memory.
- Human Tasks use the same durable server adapter as Web intake. The deployed Ops API requires
  `task.contact.read` and fails closed if the adapter is unavailable.
- Supabase SSR authentication and database-backed RBAC are implemented. Operational routes derive
  identity from the verified session and enforce the same server-side permission matrix as pages.
- `ops_memberships` is the sole role authority; client metadata, user metadata, email addresses, and
  navigation visibility are never authorization inputs.
- Role changes write membership and audit evidence atomically. Knowledge and Human Task reads use
  durable server adapters. P0-14 exposes only the canonical status transition API: every change
  records actor, reason, and timestamp; arbitrary status writes and terminal recovery are rejected.
  Notes UI, quote/payment activation, and payment controls remain absent until P0-15/P0-17.
- Partner and payment operations are not yet available.

Production use still requires OA-001, OA-004, and OA-010 verification. Missing Auth or database
configuration fails closed; there is no production memory-role fallback.

## Required Roles

| Role     | Allowed scope                                                       |
| -------- | ------------------------------------------------------------------- |
| Operator | Task triage and fulfilment; limited contact access                  |
| Editor   | POI, fact, and knowledge-gap workflow; no payment or contact access |
| Admin    | Partner, role, price, and audit configuration                       |

Roles are intentionally non-hierarchical. Admin does not silently inherit Editor or Operator access;
each permission is explicit. An Admin cannot change their own role through the UI, reducing accidental
total lockout. The first Admin is bootstrapped only by the OA-010 trusted-console procedure.

The role source must be trusted app metadata or an independent membership table. User-editable
metadata is forbidden.

Fact review, expiry, conflict resolution, and sanitized knowledge-gap handling follow
[ADR-0006](../adr/ADR-0006-knowledge-evidence-and-index-quality.md). Fact creation and editing retain
source class, locator, bounded evidence summary, and confidence. Save always leaves changed evidence
as an unverified draft; `Mark reviewed` is a separate action and rejects model-only, user-report, or
uncorroborated evidence until an editor replaces it with independently reviewable evidence.
The review action derives reviewer identity from authenticated Ops access, applies the deterministic
v1 cadence, and cannot accept a client-authored reviewer or an expiry beyond the policy maximum.

## Verification

```bash
pnpm --filter @visepanda/app-ops typecheck
pnpm --filter @visepanda/app-ops test
pnpm --filter @visepanda/app-ops build
```

Every protected route requires 401, 403, allowed-role, and field-minimization tests before production.
