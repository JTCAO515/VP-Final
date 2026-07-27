# ADR-0012: Phase 0 Telemetry Observation Contract

Date: 2026-07-27
Status: Accepted
Deciders: architecture owner through Issue #156 / P0-19a
Owner: data platform / privacy
Review date: before P0-19b producer rollout or any payment event producer

## Context

The durable `events` relation already carries Copilot operational observations, but it did not define
one privacy-safe contract for browser capture, server lifecycle events, and Phase 0 funnel analysis.
A generic browser event endpoint would allow forged identities, arbitrary JSON, content collection,
or silent retention drift. Counting from ad hoc client telemetry would also make the commercial
funnel un-auditable.

## Decision

- `events` is the single Phase 0 product-observation ledger. Each new row has exactly one trusted
  verified-user or signed-anonymous identity, a registered action, object-shaped allowlisted
  properties, and an explicit future retention deadline.
- The browser capture schema is intentionally smaller than the stored schema. It accepts only
  `guide_viewed`, `poi_viewed`, `scene_filter_used`, `human_help_viewed`, and `task_started`, with
  bounded non-content dimensions. It cannot supply identity, id, timestamp, surface, retention,
  partner, click id, intent, or arbitrary property keys.
- The server derives identity from `RequestIdentity`, fixes browser events to the Web surface, and
  derives id, creation time, and the configured 180-day event deadline. Server-owned producers may
  use additional registered actions only after their authoritative operation succeeds.
- Text that resembles a credential, cookie, signature, bearer token, email address, phone number, or
  other contact material is rejected. Fixed-point numeric amounts are safe dimensions, not phone
  values. Provider keys, cookies, signatures, prompts, message bodies, and raw provider payloads are
  never event fields.
- `outbound_clicked` and `partner_redirected` require a durable partner and click UUID. Payment action
  names are contract-only until the payment boundary is separately accepted; no payment producer or
  terminal-user cost surface is introduced here.
- Phase 0 uses three private live views, not materialized views:
  `internal.phase0_funnel_daily`, `internal.phase0_outbound_daily`, and
  `internal.phase0_human_help_daily`. They expose aggregates plus bounded dimensions only, have no
  public/Data API grant, and have no refresh job that can drift.
- Postgres is authoritative. Optional PostHog delivery happens only after durable event preparation
  and cannot undo a stored event. A primary operation may defer telemetry, but telemetry capture
  itself must return an honest failure if its own durable write cannot be accepted.

## Consequences

- Domain, database, router, and Web route tests must prove identity derivation, client-field
  rejection, retention, action/property allowlists, outbound continuity, view privacy, and honest
  failure behavior.
- P0-19b connects Copilot, Explore, outbound, and Human Help producers after this contract merges;
  it may not re-open the schema contract or use payment events before P0-17.
- Existing operational Copilot actions remain supported but now use the same registered-action and
  property boundary. A forward migration is required for any new action, property shape, retention
  change, or public aggregate access decision.

## Rollback

Disable a producer or browser caller if it emits invalid events; primary product behavior remains
honest without telemetry. Repair schema defects only with a forward migration. Do not re-open generic
client writes, remove retention, expose the internal views, or retain unrestricted event payloads.
