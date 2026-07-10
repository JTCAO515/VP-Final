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

## Current State

- Knowledge uses a Postgres adapter when `DATABASE_URL` is present and an in-memory adapter otherwise.
- Human Tasks are seeded and stored in process memory.
- Authentication and RBAC are not implemented in the current mainline.
- Partner and payment operations are not yet available.

Therefore Ops is a development shell, not an authorized production console.

## Required Roles

| Role | Allowed scope |
| --- | --- |
| Operator | Task triage and fulfilment; limited contact access |
| Editor | POI, fact, and knowledge-gap workflow; no payment or contact access |
| Admin | Partner, role, price, and audit configuration |

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
