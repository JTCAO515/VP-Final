# Runtime and Data Flows

## Copilot and Trip Flow

```mermaid
sequenceDiagram
  participant U as Traveler
  participant W as Web API
  participant C as Copilot module
  participant K as Knowledge service
  participant M as Model router
  participant T as Trip service
  participant D as Postgres

  U->>W: Message + trip reference
  W->>C: Verified request identity and input
  C->>K: Retrieve active execution facts
  C->>M: Generate typed Copilot envelope
  M-->>C: Structured output or typed failure
  C->>C: Validate envelope and TripPatch
  C->>T: Apply and save validated patch
  T->>D: Append Trip event and update snapshot
  C-->>W: Envelope + Trip + trace summary
  W-->>U: Message first, Trip Canvas update
```

The current implementation already validates the envelope and applies TripPatch values. Intent
routing, retrieval, generation, and day completion still have deterministic defaults. Public
release requires verified session identity, real provider routing, durable tracing, and honest
failure behavior.

## Identity and Trip Authorization Flow

```mermaid
sequenceDiagram
  participant B as Browser
  participant W as Web route
  participant I as Identity context
  participant T as Trip service
  participant D as Postgres

  B->>W: Request + cookies + trip id + expectedVersion
  W->>I: Verify Supabase SSR session or signed anonymous cookie
  I-->>W: Effective owner context
  W->>T: Owner-scoped operation
  T->>D: Conditional owner/version read or write
  D-->>T: Trip, 404, or version conflict
  T-->>W: Typed result
  W-->>B: Honest 401 / 404 / 409 / success response
```

Client-supplied `userId`, `anonId`, email, owner, and `currentTrip` cannot authorize a request.
Anonymous claim requires both the verified user and current signed anonymous session. Share tokens are
public read-only capabilities. The binding contract is [ADR-0004](../adr/ADR-0004-identity-trip-ownership-security.md).

## Two-Pass Trip Generation

1. The first pass returns a Trip skeleton quickly.
2. The UI renders the skeleton and a generation state.
3. A silent second pass fills empty days; it does not create a second chat message.
4. Each completed day becomes a validated patch.
5. Durable implementation must use a job id and idempotency key so retries cannot duplicate blocks.
6. Partial failure preserves valid completed work and exposes a retryable state.

## Knowledge Flow

```mermaid
flowchart LR
  Sources["Official, merchant, or reviewed sources"] --> Fact["Execution fact"]
  Fact --> OpsReview["Ops review and expiry"]
  OpsReview --> Explore
  OpsReview --> Retrieval["Copilot retrieval"]
  OpsReview --> SEO["Guide and POI pages"]
  Questions["Unanswered user questions"] --> Gap["Knowledge gap"]
  Gap --> OpsReview
```

Only active, non-expired facts may reach public consumers. `source`, confidence, verification time,
expiry, status, and version are part of the fact contract. A low-evidence answer must say that the
system does not know.

## Human Task Flow

1. A traveler or Copilot creates a draft request.
2. The traveler reviews and submits it; no task is created silently.
3. Ops triages the task and may quote a price.
4. Payment evidence moves the task to paid; status alone is insufficient evidence.
5. An operator fulfils the task, records evidence, and closes or cancels it.
6. Safe transcript patterns may create knowledge-gap drafts after redaction and review.

The current Web and Ops task paths are not yet one durable production flow. Until persistence,
identity, and role checks are complete, the UI must not claim production concierge fulfilment.

## Outbound Commercial Flow

1. A commerce-intent response or relevant execution surface requests a partner action.
2. The server checks partner status, category, city, and host allowlist.
3. The UI shows an adjacent disclosure.
4. The click goes through the outbound gateway and receives a click id.
5. The gateway writes the click ledger and redirects to the approved host.
6. Partner reports are reconciled later; a click is not revenue.

Raw partner URLs are forbidden in product code. Pending or inactive partners must not be visible or
redirectable.

## Telemetry Flow

Telemetry accepts only registered action names and allowlisted properties. Event failures must not
break the primary user action. Contact details, raw prompts, model secrets, and unrestricted payloads
must not enter analytics. Commercial and payment ledgers remain authoritative even when a matching
telemetry event is missing.
