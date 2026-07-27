# ADR-0013: Human Task Transition Telemetry Staging

Date: 2026-07-27
Status: Draft
Deciders: architecture owner through Issue #322 / P0-19b
Owner: data platform / Human Help
Review date: before P0-19b producer rollout

## Context

ADR-0012 freezes the Phase 0 telemetry action catalog. It includes `task_submitted` and
future quote/payment/completion actions, but it deliberately contains no action for the currently
enabled controlled-preview Ops transitions: `requested -> triaged`,
`requested -> cancelled`, and `triaged -> cancelled`.

P0-19b must connect authoritative producers without inventing a lifecycle meaning. Mapping an Ops
triage or cancellation to `quote_created`, `payment_link_clicked`, `task_paid`, or `task_done`
would make the funnel factually false. Adding a generic event at the producer layer would bypass
the schema-first, allowlisted action contract and its privacy review.

## Candidate Decision

This draft proposes the following narrow Phase 0 staging rule for independent review:

- P0-19b emits `task_submitted` only after the durable Human Task intake succeeds. It remains the
  sole Human Help lifecycle event in the current controlled preview.
- Browser-originated `human_help_viewed` and `task_started` retain their already accepted bounded
  capture meanings. They are not status-transition evidence.
- Current Ops triage and cancellation mutations emit no product telemetry event. Their existing
  permission-bounded mutation and audit behavior remains authoritative; omitting a telemetry row
  is more truthful than reusing a different action name.
- `quote_created`, `payment_link_clicked`, `task_paid`, and `task_done` remain contract-only. No
  producer may emit them until the corresponding authorized state/payment behavior is separately
  accepted and available.
- A later need to observe triage or cancellation requires a schema-first follow-up: an explicitly
  named action, strict bounded property schema, retention/privacy review, additive migration, and
  producer integration after that contract merges. It must not be added opportunistically in an
  Ops route.

## Alternatives Considered

### Emit a generic transition event now

Rejected by this draft. The current registered-action and database allowlists do not define it, so
this would be an unreviewed D2 contract change.

### Reuse future quote, payment, or completion events

Rejected. None of the enabled controlled-preview transitions has those meanings; this would corrupt
the Human Help funnel and create an implied payment/completion claim.

### Stop all P0-19b producer integration

Rejected. Copilot, Explore/Guide, durable outbound, and Human Help intake producers have accepted
semantics independent of this narrow Ops-transition gap.

## Consequences if Accepted

- P0-19b can implement its non-payment producer set without a schema or migration change.
- The private Human Help funnel records intake, not unsupported operational conversion stages.
- P0-19d can derive a real public telemetry endpoint limit only after these producers establish
  observed event density.
- This ADR does not change the Human Task state machine, payment boundary, permissions, retention,
  browser capture contract, or public service promises.

## Rollback

Disable an individual P0-19b producer if it violates ADR-0012's identity or property constraints.
Do not fabricate a replacement lifecycle event. A future accepted transition-action contract is
additive; it does not rewrite prior observations.
