# Server Module

Path: `apps/server`

## Responsibility

The server package is the modular monolith. It owns request validation, business orchestration,
service interfaces, persistence adapters, and the root tRPC router. During Phase 0 it is imported by
Next.js runtimes rather than deployed as an independent service.

## Root Router

`apps/server/src/router.ts` composes:

- `copilot`: route, retrieve, generate, validate, apply Trip actions, and two-pass completion.
- `commerce`: active-partner lookup, safe outbound construction, and durable click recording.
- `trip`: owner-scoped create/read/Patch/claim/share/revoke operations through the versioned Trip service.
- `knowledge`: POI/fact/gap reads and operations workflow.
- `task`: owner-scoped Human Task intake/reads plus authorized, audited lifecycle transitions.
- `telemetry`: event validation and ingestion interface.
- `trace`: private agent-run and tool-call metadata recording.
- `readiness`: owner-scoped persistence and retrieval of deterministic, consented China Readiness
  self-reports.

`identity` remains a reserved domain boundary rather than a complete standalone module.

## Service and Adapter Pattern

- Routers validate transport input and call services.
- Service interfaces are defined inside their owning module.
- `src/db` contains Drizzle adapters for implemented durable paths.
- The shared Postgres.js client disables prepared statements so Vercel serverless traffic remains
  compatible with the approved Supavisor transaction-mode connection.
- In-memory services support tests and explicit demos only.
- Readiness persistence accepts only the fixed domain assessment/result shape after explicit consent.
  An anonymous result must be attached to a currently owned Trip; an authenticated traveler may
  save either an owned Trip result or an account-level result. The server derives every owner field,
  never accepts free-form narrative, and stops reads at the retention deadline.
- Runtime dependencies are injected through `ServerContext` or a caller factory.
- `@visepanda/app-server/runtime` owns explicit mode parsing, database capability metadata, and the
  persistent-object ownership inventory. It does not select a service inside a router.
- Partner administration is a private Ops composition boundary, not a public root-router procedure.
  The service requires both the Admin role and explicit partner permission. Its Postgres adapter uses
  one transaction-level lock to validate exact-host uniqueness, preserve immutable keys, calculate
  bounded audit metadata from the locked current row, write the configuration/status, and append the
  audit event atomically.

## Current State

- Trip, knowledge, agent trace, and Human Task intake have in-memory and Postgres adapters. Trace records use one trusted
  authenticated identity, one signed anonymous identity, or neither; they persist only digests and
  allowlisted operational metadata. Provider/tool payloads and raw errors are excluded.
- Copilot retains deterministic defaults only in explicit tests and `local-demo`. In any other runtime,
  DEMO-01 injects the v3 provider route executor, records safe attempts through Trace, performs bounded
  JSON candidate repair before Zod validation, normalizes a provider string `message` into the typed
  Copilot message object, forwards provider-specific compatibility body fields from the AI inventory,
  and fails with a typed configuration-unavailable error when a required route lacks a trusted model
  name or credential.
- The accepted ADR-0015 public-runtime policy has one server-owned parser for its numeric ceilings.
  Copilot input defaults to at most 8,000 JavaScript string code units, every model attempt defaults to
  at most 1,600 output tokens, and authenticated rate limits default to 20 requests/minute and
  120/hour. Deployment settings may only lower these hard ceilings and invalid values fail closed.
  The model runtime already clamps primary and fallback attempts to the stricter request/provider and
  public output-token bound. The Web boundary rejects an over-limit message with typed HTTP 413 before
  any request-protection or model composition work. A verified account then passes a separate
  domain-separated-HMAC authenticated identity window after the trusted-network guard; a missing
  dependency returns an honest unavailable response and never falls back to process-local enforcement.
  The Human Task service independently accepts at most one new controlled-preview request per verified
  identity and China day; a safe idempotency replay is not a new submission, while the global
  Shanghai five-task capacity remains a final separate guard.
- The deployed DEMO-01 path is dialogue-only. It rejects Trip actions, tools, commerce, Human Help,
  and citations before any state-changing branch can run. Real provider evidence remains blocked on
  OA-005 and is not claimed by this repository change.
- Anonymous Copilot access uses a server-owned turn-counter interface keyed only by a SHA-256 digest
  of the verified signed anonymous id. The Upstash adapter atomically reserves one of the configured
  slots (three by default), counts only successfully completed turns, releases model failures, and
  expires inactive counters after 30 days. A per-lease completion marker makes an ambiguous HTTP
  response safe to retry once without double-counting. A completed limit and capacity temporarily
  held by in-flight requests are distinct errors, so concurrency cannot create a false registration
  claim. Authenticated users bypass this anonymous-only control. Missing Redis configuration fails
  closed under OA-012; only tests and explicit `local-demo` use the injected memory reference.
- Every valid Copilot HTTP request also passes a route-level IP guard before the model pipeline. The
  Web trust boundary supplies only the first valid Vercel `x-vercel-forwarded-for` address; the
  limiter HMACs it with a separate server-only salt before an atomic Upstash sorted-set operation.
  The default windows are 10 requests/minute and 60/hour, both env-configurable. Redis receives no
  raw IP or salt and expires each bucket after one hour. Tests and explicit `local-demo` share one
  fixed local identity; any other non-Vercel runtime, missing salt/configuration, invalid trusted
  header, Redis failure, or invalid response fails closed before model execution under OA-013.
- The Copilot route's unexpected and unavailable failures report only a generated correlation id,
  route (`/api/copilot`), capability (`copilot`), and normalized failure class through the safe
  server logger. It never hands the logger an error object, request body, identity, address, cookie,
  secret, signature, model payload, or cost record. Sentry remains an optional OA-008-owned reporter;
  no Sentry setting or package is required for the safe local log path.
- Knowledge, Human Task, and Telemetry routers require a service selected by the composition root;
  omitted capabilities return typed `SERVICE_UNAVAILABLE` and never construct memory internally.
- P0-19 makes the generic telemetry capture router a narrow browser boundary rather than a generic
  ledger write API. It accepts only the domain's client-safe action subset and bounded dimensions,
  then derives a single trusted identity from `RequestIdentity`, fixes the Web surface, and delegates
  id/timestamp/180-day expiry to the telemetry service. The Postgres adapter writes the validated row
  before optional PostHog delivery; delivery failure cannot erase the durable event, while a telemetry
  write failure is reported safely and never faked as capture success. P0-19b wires only the
  registered producer subset after its authoritative action: Copilot records submission, successful
  skeleton/Patch, completion detail, failure, and approved Human Help suggestion metadata; outbound
  records `outbound_clicked` and `partner_redirected` only after the click ledger commits; Human Task
  intake records `task_submitted` only after durable creation. The producer payloads contain only
  trusted identity, registered action, entity, optional intent, and allowlisted dimensions. Ops
  triage/cancellation emits no product telemetry, and `quote_created`, `payment_link_clicked`,
  `task_paid`, and `task_done` remain contract-only until their owning boundaries are accepted.
- P0-17 introduces the private `human_task_payments` ledger contract before any Stripe runtime is
  enabled. A future authorized Ops-only Checkout writer must create exactly one record for a quoted
  task, transition it to `payment_pending` only after that durable record exists, and use the
  provider's opaque Checkout session id for idempotency. A future webhook consumer may transition to
  `paid` only after signature verification and a ledger update carrying the provider payment-intent
  and event ids. No client route, task status, redirect, or raw provider payload is payment proof on
  its own. Missing runtime configuration must remain an honest unavailable response. The first
  server-only Stripe Checkout adapter is an explicit opt-in (`VISEPANDA_HUMAN_TASK_PAYMENTS_ENABLED`
  must equal `true`) and requires an HTTPS success URL, HTTPS cancel URL, retention-days value, and
  `STRIPE_SECRET_KEY`; otherwise it returns no gateway. It requests only a hosted one-time Checkout
  session with the task id as opaque provider metadata and a server-authorized cents amount. Before
  that writer can be reached, `triaged -> quoted` is an Ops-only preparation transition that stays
  absent unless both the Checkout configuration and the signing-webhook configuration resolve. It
  sets neither a price nor a payment link, and is never payment evidence. The adapter does not write
  the ledger, change task status, expose raw provider errors, or accept card data; the
  authorized writer and signed webhook consumer remain separate boundaries. The private Checkout
  writer locks one task before it asks the provider for a session, replays the existing matching
  ledger row without a second provider call, and commits the ledger row, task price/link,
  `payment_pending` transition, and non-sensitive Ops audit metadata together. It is callable only
  by an Ops actor with `task.write`, only while a task is `quoted`, and only with a configured
  gateway injected by a later composition boundary. A provider success followed by database rollback
  may leave an unreachable provider session, but cannot leave a payment-pending task or user-visible
  link without the matching ledger row. The webhook verifier separately authenticates the exact raw
  request body using Stripe's `t.payload` HMAC-SHA256 signature, one bounded timestamp, and one or
  more constant-time `v1` signatures before it parses JSON. It accepts only a paid USD Checkout
  completion whose signed client reference exactly matches its signed task metadata, then returns a
  minimal provider-event/session/intent/task/amount projection. It neither stores nor returns the
  raw payload, signature, secret, or non-payment event fields. The provider-only webhook consumer
  reads the exact raw body once, verifies it before JSON parsing, then atomically requires the
  private ledger's session, task, amount, currency, and open status to agree before it records the
  event/payment-intent evidence and advances the matching task to `paid`. An exact duplicate event
  replays safely; a mismatched or unavailable event never changes either row. It records neither raw
  payload/signature nor provider ids in the audit metadata, and it has no traveler-facing Checkout,
  payment-success, or fulfillment surface.
- P0-19d protects the public browser capture route before `TelemetryService.track` with two atomic
  Upstash sliding windows: a HMAC-derived verified-identity window (`60/minute`, `300/hour` by
  default) and a separate HMAC-derived Vercel trusted-network window (`180/minute`, `900/hour`).
  Both must admit a request. The limiter returns a visible 429/`Retry-After` when either is exhausted
  and a typed 503 when trusted Vercel evidence, Redis, or the HMAC salt is unavailable. Rejections
  increment only an HMAC-keyed, one-hour per-network Redis counter; they do not become telemetry rows
  and cannot turn an abuse flood into durable database growth.
- P0-18b connects the frozen outbound contract to the Commerce router and Postgres adapter. In one
  transaction, the adapter locks the requested partner, requires its current database status to be
  `active`, validates the exact HTTPS host allowlist, derives exactly one verified-user or signed-
  anonymous identity, and inserts the click before returning a redirect. A ledger failure is
  authoritative and prevents redirect; optional product telemetry runs only after the ledger commit
  and cannot undo a valid redirect. No partner is activated by code, and Ops partner mutation remains
  a separate P0-18c boundary.
- The knowledge bulk-import adapter is durable-only. It validates the fixed six-city CSV at the trust
  boundary, dry-runs against database identities, commits only a wholly valid batch in one transaction,
  and records private editorial provenance separately from public fact reads. `local-demo` and test
  compositions do not pretend a persistent import occurred.
- KnowledgeService separately owns canonical POI identity writes for authorized Ops users. It accepts
  only the bounded Domain POI create/update contract, generates ids and owns source ids, and preserves
  facts unchanged. The verified Ops actor is passed separately from the Domain contract so each accepted
  durable write atomically appends a content-free completed audit record. Database writes return an
  honest missing result for an unknown id and store either both coordinates or neither; source, review,
  and public eligibility remain exclusively fact-lifecycle concerns.
- SEO editorial overrides are a separate private presentation relation, keyed by POI and frozen
  intent. Its durable and in-memory services expose only get/save/delete of bounded title, summary,
  and emphasis fields. The server/ops writer derives the current evidence-gated candidate before it
  may read or save one; the Web consumer resolves the same candidate before it reads and applies one.
  An override has no POI-fact write path, carries no provenance fields, and cannot restore a candidate
  whose supporting facts have expired or become ineligible.
- Local-facing Chinese POI values use the durable `poi_facts` lifecycle rather than promoting legacy
  `pois.name_zh` or `pois.address` strings. The Drizzle mapping mirrors the database constraint for
  five bounded local-presentation fact types; current eligible values are derived only in the domain
  package, while later display guards own any user-facing fallback behavior. Both create and update
  paths parse those types as a strict `{ text }` value with a 500-character maximum, so a generic
  `{ label }` write cannot silently remove the local-display meaning. Their source provenance remains
  draft-only until the separate review transition writes `verifiedAt`.
- Copilot knowledge retrieval resolves a unique POI or city through the domain's deterministic lexical
  resolver before it filters eligible facts. A known Chinese name, pinyin, approved alias, or bounded
  one-character Latin typo may resolve a candidate; unmatched and cross-city ambiguous references return
  no facts rather than widening to the catalog. This lookup metadata never changes ADR-0006 evidence
  eligibility.
- ADR-0016's `safe_phrases` mapping is private and consumed only by a server-side exact-key resolver.
  A high-risk request bypasses model generation; a fixed expression must match the controlled
  category/scene/intent/variant/severity key and pass the domain's current-review check. Missing,
  stale, ambiguous, or severity-mismatched expressions return the ADR's fixed unavailable text
  rather than a model-authored substitute. The public chat route does not accept arbitrary phrase
  selections, so until a separately governed controlled surface supplies one, high-risk chat input
  remains on that unavailable path.
- ADR-0017's accepted VisePod Studio data path stores private device-assignment history and a bounded
  idempotency replay carrier. A device has at most one active assignment through a database partial
  unique index; rebind revokes the old row before creating the new active row, while account deletion
  cascades bindings and their dependent replay records. The replay carrier stores only a canonical
  command SHA-256 digest and bounded result projection, never free-text reasons, provisioning tokens,
  device secrets, Wi-Fi credentials, or user credentials.
- The private provisioning service issues, validates, and explicitly revokes opaque eight-hour
  `visepod.provision` grants. The Studio binding service validates that grant online before it reads a
  device, binding, user, or idempotency receipt; every validation rechecks current Ops permission.
  It then atomically commits a create/rebind/revoke, 30-day replay receipt, and bounded
  `ops_audit_events` row. Audit failure rolls the entire mutation back. The controlled Studio scope
  recognizes only the server-owned `VISEPOD_STUDIO_DEVICE_IDS` allowlist; it is a finite device catalog,
  not a device registry, and contains no secret or user data. Exact user resolution validates an online
  provisioning grant before it rate-admits the grant issuer through an Upstash HMAC-keyed window, then
  performs only an exact email/UUID equality read and atomically records a non-reversible
  identifier-digest audit row. It has no browse, list, cursor, prefix, or fuzzy-match path; an unavailable
  limiter fails closed before a user read.
- After Zod envelope validation, the Copilot pipeline scans all user-presentable envelope fields for
  concrete address, route/line, time, and price values. Each such value must be present in a cited,
  currently retrieved fact value; an unsupported value throws before any Trip patch can be applied.
  This is intentionally stricter than prompt grounding and has no model/fallback bypass.
- Human Task creation accepts only a trusted authenticated or signed-anonymous identity, a UUID
  idempotency key, and the minimized controlled-preview request. A successful idempotency replay is
  returned before capacity checks and never consumes another slot. For a verified identity, the
  Postgres adapter serializes one new request per China day under a per-identity transaction lock;
  a distinct same-day request returns a typed capacity error. It then serializes the separate daily
  Shanghai global capacity check. The lock input is transient and no raw identity reaches logs or
  public diagnostics. The adapter stores exactly one owner and never creates a duplicate row. P0-14
  adds one transition service used by memory and Postgres adapters: it derives the actor from trusted
  Ops access, validates the domain edge, enforces the controlled-preview policy, and writes status
  plus append-only actor/reason evidence in one transaction. The preview permits triage and
  pre-payment cancellation only; quote/payment/fulfilment states remain policy-gated.
- P0-15 extends the same Human Task service with Ops-only detail reads and operator-note updates.
  Detail reads require `task.contact.read`; note writes require `task.write`. The Postgres adapter
  commits the note update and a PII-free `human_task.note.updated` audit event in one transaction.
  The audit metadata records only whether a note is present, never the note, request description,
  contact details, cookie, signature, or credential.
- P0-16 adds append-only private evidence for current terminal Human Tasks. The service sanitizes
  contact data before persistence, rejects high-risk secrets/documents, and atomically appends a
  content-free audit event. A separate KnowledgeService transaction creates only a normalized open
  gap plus audit; it cannot create, review, or publish a POI fact.
- The explicit Ops permission matrix reserves `cost.read` for Admins only. It grants access only to
  sanitized private aggregates and reconciliation metadata through a protected server consumer; it
  does not grant direct Data API access or expose conversation content.
- The Ops cost-summary adapter queries only the accepted `internal.copilot_cost_*` views after an
  explicit `cost.read` check. Its 14-day UTC projection includes daily/model totals, cached-input and
  fallback rates, top identity aggregates represented by one-way short references, and unpriced-call
  health counts. Raw identity ids, Agent Run ids, conversations, credentials, cookies, and signatures
  are not part of the service result.
- When `VISEPANDA_DAILY_LLM_BUDGET_USD` is configured with a positive fixed-point USD value, the
  durable Trace writer observes the retained UTC-day cost total after each committed model run.
  Crossing the threshold appends at most one private `daily_budget_exceeded` event for that UTC day,
  with only the fixed-point threshold and observed total. The warning is observational: failures are
  logged without undoing the cost ledger, and neither crossing the threshold nor observation failure
  stops Copilot service. An unset threshold leaves warning emission explicitly disabled.
- The Copilot runtime writer commits the private Agent Run, one pre-redacted conversation turn, and
  every model-attempt cost row in one transaction. Cost rows copy the immutable provider/model,
  runtime effort, reported tokens, cache subset, three prices, fixed-point USD result, fallback flag,
  latency, and normalized failure from the attempt snapshot; the writer never estimates missing
  usage or recalculates model output. Missing pricing remains zero and emits
  `cost_pricing_missing`. Session start, turn completion/failure, fallback, anonymous-wall, and IP
  limit events contain only allowlisted operational properties. A session id is an opaque stable
  digest-derived UUID from trusted request identity, never a client-provided id or raw cookie.
- Provider errors retain only normalized failure class, model id, and provider-reported usage when
  the response supplies it. Invalid structured output carries its completed attempts into the failed
  run, so validation failure cannot erase a billed call; absent usage stays zero and is never estimated.
- Conversation, cost, and event deadlines default to 180, 400, and 180 days and may be changed only
  through `VISEPANDA_CONV_RETENTION_DAYS`, `VISEPANDA_COST_RETENTION_DAYS`, and
  `VISEPANDA_EVENT_RETENTION_DAYS`. Invalid or non-positive values fail persistence preparation.
  Database-write failure emits a content-free operational warning and cannot alter the validated
  Copilot answer or Trip result.
  The 400-day cost lifecycle is independent of the 30-day Agent Run lifecycle. The accepted trigger
  requires the opaque Agent Run id at insert time and keeps that immutable correlation id after trace
  purge without cascading the retained cost row.
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
- P0-10b connects that contract to the official QStash client. The queue payload contains only job id
  and idempotency key; callback signatures are checked before parsing or claiming. The Postgres job
  service derives ownership from the linked Trip, atomically increments attempts, suppresses
  duplicate delivery, and exposes owner-scoped status/retry operations. The real planning route
  produces one strictly validated block per empty day and records only digests plus provider cost in
  Agent Trace. There is no deterministic production block generator. A ten-minute claim lease lets
  a later process reconcile an interrupted `running` job without overlapping the five-minute callback
  budget or duplicating an event already linked by provenance.
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
- POI fact review is accepted only through the authenticated Ops endpoint. Reviewer identity comes
  from server-side access; fact promotion and `knowledge.fact.review.completed` audit append commit
  atomically. Public tRPC callers cannot promote a fact.
- Bulk import never promotes an input row: imported facts are drafts even when their collection record
  has been independently reviewed. The explicit fact review transition remains the only publication
  path. A repeated collection row with the same digest is a no-op; a reused row id or fact id with
  different content aborts the batch rather than overwriting evidence. Every non-empty committed import
  also writes one private batch UUID and attaches it to each new editorial-audit row; dry-runs,
  duplicate-only commits, and historical rows carry no invented batch identity.
- Existing Trip persistence receives only a validated Patch plus trusted identity, expected version,
  and event source; creation receives the initial validated Trip.
- A module may not import another module's tables.
- The production database client MUST keep prepared statements disabled while OA-004 uses Supavisor
  transaction mode; changing pooler mode or this client option requires a new reviewed runtime
  compatibility decision and deployed evidence.
- Production configuration may not silently select an in-memory adapter.
- Routers MUST NOT import a memory service factory or select an adapter. Tests and composition roots
  inject services explicitly; an omitted optional capability fails closed.
- Public request identity comes only from verified session context or the signed anonymous cookie.
- Partner administration MUST derive its actor from verified Ops access. Configuration writes MUST
  preserve status, while status changes require a separate action and explicit confirmation before
  activation. Repository data remains pending unless an authorized operator deliberately changes it.
- Anonymous turn limits MUST reserve capacity atomically before generation and MUST NOT trust a body,
  browser counter, or raw anonymous identifier. A blocked request cannot reach the model. A failed
  model request releases its reservation and does not consume a completed turn.
- Copilot IP limits MUST trust only Vercel's `x-vercel-forwarded-for`; `x-forwarded-for`, request
  bodies, cookies, and browser state have no IP authority. Raw client addresses and the HMAC salt
  MUST NOT enter Redis keys, Redis arguments, logs, traces, events, or public errors.
- P0-03 introduces the shared `RequestIdentity` context for verified Supabase sessions or signed
  anonymous sessions. P0-04 consumes it on every Trip owner route.
- [ADR-0005](../adr/ADR-0005-runtime-modes-and-production-adapter-ownership.md) freezes explicit modes, single durable production owners, and the prohibition on implicit production memory fallback.
- [ADR-0004](../adr/ADR-0004-identity-trip-ownership-security.md) freezes the target identity,
  owner, share, claim, and optimistic-concurrency contract for P0-03/P0-04.
- [ADR-0007](../adr/ADR-0007-agent-trace-privacy-retention.md) freezes trace minimization, restricted
  retention, and non-blocking trace persistence. Real provider attempt production data remains P0-07.
- [ADR-0009](../adr/ADR-0009-copilot-conversation-cost-retention.md) freezes separate redacted turn,
  per-attempt cost, and product-event records. The additive #248 cache-pricing contract preserves
  total input tokens, adds a bounded cached-input subset and separate hit-price snapshot, and retains
  `cost_pricing_missing` events. The runtime writer consumes those frozen contracts. #249 adds cached
  input/cache-hit aggregates, an unpriced-call reconciliation view, and the operations-only
  `daily_budget_exceeded` event contract without changing the accepted cost formula.
- The Copilot runtime preserves the provider route separately from the actual pricing provider and
  carries the cache-aware, fixed-point attempt cost snapshot into the allowlisted trace object.
  The exact snapshot is now written per attempt; the legacy Agent Run total remains a bounded summary,
  not the source of truth for financial reconciliation.
- OA-011 remains the release gate for QStash token, signing keys, callback URL, and one sanitized
  signed-delivery observation. Until then deployed completion returns an honest unavailable state.
- OA-012 remains the release gate for the Upstash Redis REST endpoint/token and one sanitized
  three-success/one-blocked observation. Until then anonymous Copilot access returns an honest 503;
  authenticated Copilot access does not depend on this anonymous-only counter.
- OA-013 remains the release gate for the independent IP HMAC salt, deployed limits, Vercel trusted
  header behavior, and one sanitized 429 observation. Until then every deployed Copilot request
  fails honestly before model execution rather than bypassing request-cost protection.

## Verification

```bash
pnpm --filter @visepanda/app-server typecheck
pnpm --filter @visepanda/app-server test
pnpm --filter @visepanda/app-server build
```

Security-sensitive changes also require database or API-level ownership tests.

### Deterministic execution-safety eval gate

`pnpm evals` invokes the server-owned `executionSafety.evals.test.ts` suite in addition to the
trip-generation golden set. The suite uses the real Copilot pipeline to lock high-risk fixed
expressions, honest unavailable behavior, and rejection of unsupported executable facts. It is a CI
gate, not a provider-quality sample; no safety regression may be waived by changing a prompt or
replacing fixtures with model output.

### Deterministic Copilot policy eval gate

`pnpm evals` also invokes `policyRegression.evals.test.ts`. It locks the commerce-intent gate,
review-before-submit Human Help handoff, malformed and business-rule-invalid TripPatch rejection,
no-evidence honesty, and medical/passport fixed-unavailable paths. It uses only deterministic local
fixtures and cannot make a provider, payment, task-creation, or public-policy claim.

### Provider configuration readiness

When durable Web services are composed, an incomplete DEMO-01 provider route emits one structured
`copilot_provider_configuration_degraded` warning containing only route/provider and the relevant
model/key environment-variable names. It is a private deployment diagnostic, never a public health
endpoint; the requested Copilot capability continues to use its typed unavailable response.
