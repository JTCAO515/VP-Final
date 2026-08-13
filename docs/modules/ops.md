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
- `/tasks/:taskId`: inspect one authorized task, save a minimized internal note, review transition
  history, and apply only the controlled-preview transitions returned by the server.
- `/api/knowledge/*`: server-side knowledge operations.
- `/api/knowledge/import`: Editor-authorized CSV `dry-run` and atomic `commit` endpoint; no public
  upload surface exists.
- `/api/tasks`: permission-protected task list endpoint.
- `/api/tasks/:taskId`: `task.contact.read`-protected detail and `task.write`-protected internal-note
  and terminal-evidence endpoint. Writes append audit evidence without copying private content.
- `/api/tasks/:taskId/evidence/:evidenceId/gap`: verifies task/evidence ownership and creates only a
  normalized open knowledge-gap draft through the durable KnowledgeService.
- `/api/tasks/:taskId/status`: `task.write`-protected transition endpoint; actor is session-derived.
  Mutation responses contain status/audit evidence only and never echo contact or description.
- `/login`: verified Supabase Ops sign-in.
- `/roles` and `/api/roles`: Admin-only membership management.
- `/costs`: Admin-only server-rendered Copilot cost summary for the latest 14 UTC days. It displays
  retained daily/model aggregates, cache and fallback rates, pseudonymous top-identity references,
  and reconciliation health without exposing conversation content or raw identity ids.
- `/partners`: Admin-only partner registry and editor. Configuration saves preserve status; activation
  is a separate confirmed action. Pending records are non-clickable previews.
- `/api/partners` and `/api/partners/:partnerKey`: Admin-only list/detail/create/update/status APIs.
  They reuse the domain Partner schema and return truthful validation, conflict, missing, and
  unavailable states.

## Current State

- Knowledge follows the explicit runtime resolver: deployed modes require the Postgres adapter,
  tests inject memory, and only `local-demo` may use labelled process memory.
- Human Tasks use the same durable server adapter as Web intake. The deployed Ops API requires
  `task.contact.read` and fails closed if the adapter is unavailable.
- Supabase SSR authentication and database-backed RBAC are implemented. Operational routes derive
  identity from the verified session and enforce the same server-side permission matrix as pages.
- `ops_memberships` is the sole role authority; client metadata, user metadata, email addresses, and
  navigation visibility are never authorization inputs.
- VisePod Studio has no parallel authorization or desktop-held service secret. Its accepted contract
  reserves one explicit `visepod.provision` permission for a later server implementation; no current
  role silently receives it, and no Studio endpoint, provisioning-token issuer, or user-browsing
  surface exists. Private binding history and 30-day idempotency persistence exist only as a
  server-side schema: one device can have one active assignment, rebind retains a revoked historical
  row, user deletion cascades the binding relationship, and idempotency retains only a command
  digest rather than free-text reason content. The later runtime must recheck the
  existing Ops permission on every short-lived grant use and write accepted binding mutations to
  `ops_audit_events` only. See
  [Studio Binding Contract v1](../visepod/studio-binding-contract-v1.md).
- The explicit `visepod.provision` permission is assigned only to Admin. The server issues an
  eight-hour development-or-production grant after server-side session and permission checks, stores
  only its SHA-256 digest, and rechecks current membership on every validation. Removing the
  permission or explicitly revoking the grant invalidates it immediately.
- Role changes write membership and audit evidence atomically. Knowledge and Human Task reads use
  durable server adapters. P0-14 exposes only the canonical status transition API: every change
  records actor, reason, and timestamp; arbitrary status writes and terminal recovery are rejected.
  P0-15 adds an authorized task-detail and notes workflow. The server remains authoritative for the
  available transition list; controlled preview exposes only `requested -> triaged/cancelled` and
  `triaged -> cancelled`. Quote/payment activation, assignment, and fulfilment controls remain absent
  until their separately accepted boundaries.
- P0-16 shows private evidence only inside the authorized detail. Append controls remain unavailable
  until `done` or `cancelled`; Operators can propose a gap but cannot publish a fact or bypass Editor
  review.
- #249 reserves an explicit Admin-only `cost.read` permission for the private Copilot cost summary.
  The runtime warning observer records at most one threshold event per UTC day without stopping model
  service. The `/costs` server consumer reads only the reviewed internal aggregate/reconciliation
  views. Stable user and anonymous ids are transformed into short one-way references before reaching
  the page; no conversation, run id, credential, cookie, or signature is returned. Missing durable
  configuration shows an honest unavailable state, and an unset warning threshold is labelled as not
  configured rather than assigned a default.
- Partner configuration is available only to verified Admin sessions. Each create, configuration
  update, or explicit status transition commits the partner mutation and one bounded audit row in the
  same database transaction. Audit metadata contains field names or previous/current status only;
  host values, target URLs, contacts, credentials, cookies, and signatures are excluded. No partner
  is activated by repository defaults, and this surface does not represent affiliate approval,
  booking, commission, payment, reconciliation, or revenue.
- Payment operations are not yet available.

Production use still requires OA-001, OA-004, and OA-010 verification. Missing Auth or database
configuration fails closed; there is no production memory-role fallback.

## Required Roles

| Role     | Allowed scope                                                       |
| -------- | ------------------------------------------------------------------- |
| Operator | Task triage and fulfilment; limited contact access                  |
| Editor   | POI, fact, and knowledge-gap workflow; no payment or contact access |
| Admin    | Partner, role, cost reconciliation, price, and audit configuration  |

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

Bulk import accepts only the six-city collection-template header. A `dry-run` reports every malformed
row before any write. `commit` refuses a file with any validation/conflict error, creates POIs and
facts transactionally, leaves all facts `draft`, preserves reviewer provenance in the private audit
relation, and uses collection-row digest plus fact identity to make replay idempotent. `missing`,
`conflict`, and `rejected` collection rows are reported as skipped rather than treated as evidence.

## Verification

```bash
pnpm --filter @visepanda/app-ops typecheck
pnpm --filter @visepanda/app-ops test
pnpm --filter @visepanda/app-ops build
```

Every protected route requires 401, 403, allowed-role, and field-minimization tests before production.
