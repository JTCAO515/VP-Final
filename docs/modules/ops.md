# Ops Module

Path: `apps/ops`

## Responsibility

The Ops Next.js application is an internal operations surface for execution facts, knowledge gaps,
Human Tasks, partner configuration, and later reconciliation. It must be deployed separately from
the public Web application and protected by server-side role checks.

## Current Routes

- `/facts`: list, create, update, renew, and deprecate execution facts.
- `/gaps`: inspect and resolve knowledge gaps.
- `/tasks`: inspect and transition Human Tasks.
- `/api/knowledge/*`: server-side knowledge operations.
- `/api/tasks`: task list and update endpoint.
- `/login`: verified Supabase Ops sign-in.
- `/roles` and `/api/roles`: Admin-only membership management.

## Current State

- Knowledge uses a Postgres adapter when `DATABASE_URL` is present and an in-memory adapter otherwise.
- Human Tasks are seeded and stored in process memory.
- Supabase SSR authentication and database-backed RBAC are implemented. Operational routes derive
  identity from the verified session and enforce the same server-side permission matrix as pages.
- `ops_memberships` is the sole role authority; client metadata, user metadata, email addresses, and
  navigation visibility are never authorization inputs.
- Role changes write membership and audit evidence atomically. Until P0-06 moves Knowledge and Human
  Tasks into the same durable server boundary, those routes append an actor/timestamp `attempt` audit
  before invoking their existing stores; this is trace evidence, not a false atomic-success claim.
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
[ADR-0006](../adr/ADR-0006-knowledge-evidence-and-index-quality.md).

## Verification

```bash
pnpm --filter @visepanda/app-ops typecheck
pnpm --filter @visepanda/app-ops test
pnpm --filter @visepanda/app-ops build
```

Every protected route requires 401, 403, allowed-role, and field-minimization tests before production.
