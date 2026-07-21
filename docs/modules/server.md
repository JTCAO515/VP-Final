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
- `task`: owner-scoped Human Task intake/reads plus authorized, audited lifecycle transitions.
- `telemetry`: event validation and ingestion interface.
- `trace`: private agent-run and tool-call metadata recording.

`identity` and `commerce` directories reserve domain boundaries but are not complete production
modules yet.

## Service and Adapter Pattern

- Routers validate transport input and call services.
- Service interfaces are defined inside their owning module.
- `src/db` contains Drizzle adapters for implemented durable paths.
- In-memory services support tests and explicit demos only.
- Runtime dependencies are injected through `ServerContext` or a caller factory.
- `@visepanda/app-server/runtime` owns explicit mode parsing, database capability metadata, and the
  persistent-object ownership inventory. It does not select a service inside a router.

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
- Knowledge, Human Task, and Telemetry routers require a service selected by the composition root;
  omitted capabilities return typed `SERVICE_UNAVAILABLE` and never construct memory internally.
- The knowledge bulk-import adapter is durable-only. It validates the fixed six-city CSV at the trust
  boundary, dry-runs against database identities, commits only a wholly valid batch in one transaction,
  and records private editorial provenance separately from public fact reads. `local-demo` and test
  compositions do not pretend a persistent import occurred.
- Human Task creation accepts only a trusted authenticated or signed-anonymous identity, a UUID
  idempotency key, and the minimized controlled-preview request. The Postgres adapter serializes the
  daily Shanghai capacity check, stores exactly one owner, and replays a successful retry without a
  duplicate row. P0-14 adds one transition service used by memory and Postgres adapters: it derives the
  actor from trusted Ops access, validates the domain edge, enforces the controlled-preview policy,
  and writes status plus append-only actor/reason evidence in one transaction. The preview permits
  triage and pre-payment cancellation only; quote/payment/fulfilment states remain policy-gated.
- P0-15 extends the same Human Task service with Ops-only detail reads and operator-note updates.
  Detail reads require `task.contact.read`; note writes require `task.write`. The Postgres adapter
  commits the note update and a PII-free `human_task.note.updated` audit event in one transaction.
  The audit metadata records only whether a note is present, never the note, request description,
  contact details, cookie, signature, or credential.
- P0-16 adds append-only private evidence for current terminal Human Tasks. The service sanitizes
  contact data before persistence, rejects high-risk secrets/documents, and atomically appends a
  content-free audit event. A separate KnowledgeService transaction creates only a normalized open
  gap plus audit; it cannot create, review, or publish a POI fact.
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
  The intended 400-day cost deadline is not yet an effective lifecycle guarantee: the accepted cost
  table still cascades from the 30-day Agent Run parent. #248 requires an architecture amendment
  before merge; neither FK semantics nor ADR-0007 retention may be changed implicitly.
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
  different content aborts the batch rather than overwriting evidence.
- Existing Trip persistence receives only a validated Patch plus trusted identity, expected version,
  and event source; creation receives the initial validated Trip.
- A module may not import another module's tables.
- Production configuration may not silently select an in-memory adapter.
- Routers MUST NOT import a memory service factory or select an adapter. Tests and composition roots
  inject services explicitly; an omitted optional capability fails closed.
- Public request identity comes only from verified session context or the signed anonymous cookie.
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
  `cost_pricing_missing` events. The runtime writer now consumes those frozen contracts; aggregate
  reconciliation view extensions and ADR-0010 archival remain the separate #248d boundary.
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
