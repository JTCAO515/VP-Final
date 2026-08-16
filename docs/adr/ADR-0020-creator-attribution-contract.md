# ADR-0020: Creator Attribution Contract

Date: 2026-08-14
Status: Accepted
Owner: commercial architecture / data platform

## Context

Creator links must be attributable without allowing a raw query parameter, unguarded redirect, or
local report to redefine the commercial boundary. Existing partner/outbound controls are designed for
OTA destinations and cannot safely treat a creator source as an interchangeable link target.

## Decision

`partners.kind` distinguishes `ota` and `creator`, defaulting existing configurations to `ota`.
Only an active `ota` partner may construct an outbound HTTPS URL or enter the outbound click ledger.
A `creator` partner is an acquisition source only.

`creator_referrals` privately binds one lowercase referral key to one creator partner and one bounded
same-origin landing path. It has no external target URL and rejects a query, fragment, or
protocol-relative path. Database triggers require the referenced partner to remain `creator`; RLS and
revoked Data API grants keep the mapping server-only.

A future source consumer must resolve a referral key server-side, require its creator partner to be
active, attach only the existing trusted identity/retention semantics of the durable event and
outbound ledgers, and render the applicable referral disclosure. It must not accept raw query
attribution, infer a creator from a social handle, expose a public creator report, or activate a
partner by repository default.

## Consequences

This decision authorizes the additive contract and deterministic safeguards only. It does not create
an active creator partner, publish a landing route, render a creator disclosure, collect a real
creator click, or establish a commercial agreement. Those remain separate evidence-bound consumer
work with an operator-created active record.
