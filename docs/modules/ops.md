# Ops Module

Path: `apps/ops`

## Responsibility

The Ops Next.js application is an internal operations surface for execution facts, knowledge gaps,
Human Tasks, partner configuration, and later reconciliation. It must be deployed separately from
the public Web application and protected by server-side role checks.

## Current Routes

- `/facts`: create and edit canonical POIs, then list, create, update, renew, and deprecate
  execution facts. POI identity fields never create, review, or publish a fact.
- `/seo`: Editor-authorized bounded SEO title, summary, and editor-note overrides for an already
  eligible POI/intent candidate. It is presentation-only and offers a delete action that restores
  generated copy.
- `/gaps`: inspect and resolve knowledge gaps.
- `/tasks`: inspect the durable Human Task intake queue.
- `/tasks/:taskId`: inspect one authorized task, save a minimized internal note, review transition
  history, and apply only the controlled-preview transitions returned by the server.
- `/api/knowledge/*`: server-side knowledge operations.
- `/api/knowledge/seo-overrides`: server-side private override read/save/delete route. GET and POST
  recalculate the current evidence-gated candidate; POST and DELETE require `knowledge.write` and
  derive the actor from the verified Ops session.
- `/api/knowledge/import`: Editor-authorized CSV `dry-run` and atomic `commit` endpoint; no public
  upload surface exists.
- `/api/tasks`: permission-protected task list endpoint.
- `/api/tasks/:taskId`: `task.contact.read`-protected detail and `task.write`-protected internal-note
  and terminal-evidence endpoint. Writes append audit evidence without copying private content.
- `/api/tasks/:taskId/evidence/:evidenceId/gap`: verifies task/evidence ownership and creates only a
  normalized open knowledge-gap draft through the durable KnowledgeService.
- `/api/tasks/:taskId/status`: `task.write`-protected transition endpoint; actor is session-derived.
  Mutation responses contain status/audit evidence only and never echo contact or description.
- `/api/tasks/:taskId/checkout`: `task.write`-protected internal Checkout composition endpoint. It is
  unavailable unless the deployed database, explicit Checkout activation, HTTPS Checkout URLs, Stripe
  secret, and signed webhook configuration all resolve. It accepts an Ops-authorized cents amount
  only after a task has become `quoted`; it returns a minimized Ops-only session projection, never card
  data, contact, description, provider error body, or payment-success claim.
- `/login`: verified Supabase Ops sign-in.
- `/roles` and `/api/roles`: Admin-only membership management.
- `/costs`: Admin-only server-rendered Copilot cost summary for the latest 14 UTC days. It displays
  retained daily/model aggregates, cache and fallback rates, pseudonymous top-identity references,
  and reconciliation health without exposing conversation content or raw identity ids.
- `/partners`: Admin-only partner registry and editor. Configuration saves preserve status; the
  explicit type selector defaults to `ota`. A `creator` record is an acquisition source only and is
  never an outbound destination. Pending records are non-clickable previews.
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
- VisePod Studio has no parallel authorization or desktop-held service secret. The explicit
  `visepod.provision` permission is assigned only to Admin. The server issues an eight-hour
  development-or-production grant after server-side session and permission checks, stores only its
  SHA-256 digest, and rechecks current membership on every validation. Removing the permission or
  explicitly revoking the grant invalidates it immediately.
- `GET`, `PUT`, and `DELETE` binding endpoints consume that grant instead of an Ops session. Validation
  occurs before any protected lookup. They expose only a private server-side binding projection, require
  an operator reason only inside the command digest, retain replay receipts for 30 days, and atomically
  append one bounded audit event for the first create/rebind/revoke. The finite deployment allowlist
  `VISEPOD_STUDIO_DEVICE_IDS` decides which controlled demonstration devices exist; it never contains a
  device secret, Wi-Fi credential, or user data. `POST /api/ops/visepod/users/resolve` consumes the
  same grant and supports only one full email or UUID equality lookup. It rate-limits the grant issuer
  through a private Upstash HMAC key before reading a user; every found/missing lookup writes only a
  one-way identifier-digest audit record. Browsing, prefix, fuzzy, pagination, cursor, and list paths
  remain absent. See [Studio Binding Contract v1](../visepod/studio-binding-contract-v1.md).
- Role changes write membership and audit evidence atomically. Knowledge and Human Task reads use
  durable server adapters. P0-14 exposes only the canonical status transition API: every change
  records actor, reason, and timestamp; arbitrary status writes and terminal recovery are rejected.
  P0-15 adds an authorized task-detail and notes workflow. The server remains authoritative for the
  available transition list. It exposes `requested -> triaged/cancelled` and `triaged -> cancelled`
  by default. The internal `triaged -> quoted` preparation transition appears only when both the
  server-only Checkout and signed-webhook configurations resolve; it sets neither price nor payment
  link, is not payment evidence, and never appears to travelers. Checkout, payment confirmation,
  assignment, and fulfilment controls remain absent until their separately accepted boundaries.
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
- Creator referrals remain a contract-only private relation until a separately reviewed server
  consumer exists. Operations may not turn a creator key, social profile, arbitrary query parameter,
  or unverified partner record into a public landing source or redirect.
- Payment operations remain unavailable to travelers. The private Ops Checkout composition may create a
  hosted provider session only when every server-side configuration gate resolves; a signed webhook
  consumer is still required before any task can become `paid`.

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

Canonical POI create and update use the same verified `knowledge.write` route as fact mutations, with
authorization before any write and bounded audit metadata containing field names only. Editors can set
English and optional Chinese names, city, category, and an all-or-nothing latitude/longitude pair.
The server owns ids and `source_ids`; this workflow cannot create a fact, source claim, review state,
or public eligibility. A missing or partial coordinate pair is rejected instead of being interpreted
as a usable location.

Bulk import accepts only the six-city collection-template header. A `dry-run` reports every malformed
row before any write. `commit` refuses a file with any validation/conflict error, creates POIs and
facts transactionally, leaves all facts `draft`, preserves reviewer provenance in the private audit
relation, and uses collection-row digest plus fact identity to make replay idempotent. `missing`,
`conflict`, and `rejected` collection rows are reported as skipped rather than treated as evidence.

SEO overrides are intentionally not an alternate knowledge store. The route accepts only the frozen
POI/intent selection and bounded presentation strings. It derives the current public candidate before
reading or saving, so no operator can use copy to publish an unsupported, expired, or incomplete page.
Deletion remains available for stale private rows and restores the generated fallback once the candidate
is otherwise eligible. The UI does not expose POI fact, source, confidence, evidence, or review edits
from this route.

## Verification

```bash
pnpm --filter @visepanda/app-ops typecheck
pnpm --filter @visepanda/app-ops test
pnpm --filter @visepanda/app-ops build
```

Every protected route requires 401, 403, allowed-role, and field-minimization tests before production.
