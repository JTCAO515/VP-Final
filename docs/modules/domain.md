# Domain Module

Path: `packages/domain`

## Responsibility

The domain package is the only source of runtime-validated business types and deterministic business
functions. It must remain portable across Web, Server, Ops, and future Mobile.

## Public Areas

| Area            | Owns                                                                                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------- |
| `trip`          | TripState, TripPatch operations, `applyPatch`, `diffTrips`, generation progress                                   |
| `copilot`       | Intent, message, citations, tool cards, commercial actions, Human Help handoff, envelope, completion-job contract |
| `knowledge`     | POI, execution facts, knowledge gaps, scene-tag derivation, reviewed seed data, and ADR-0006 fact eligibility     |
| `task`          | Human Task input, lifecycle, transition commands, private outcome evidence, and non-status updates                |
| `commerce`      | Partner configuration, outbound click, URL validation and tracking construction                                   |
| `events`        | Telemetry event contract                                                                                          |
| `observability` | Redacted Copilot turn, per-attempt cost, product-event action, and forbidden-persistence contracts                |
| `errors`        | Shared typed error shapes                                                                                         |

## Invariants

- Every externally consumed domain object has a Zod schema and inferred TypeScript type.
- Pure functions do not read environment variables, databases, clocks, networks, or UI state unless
  the dependency is passed explicitly.
- Trip mutation is only performed through `applyPatch`.
- Domain enums are never copied into app-local constants.
- Optional fields stay optional; consumers do not fabricate values to make a card look complete.
- Knowledge consumers follow [ADR-0006](../adr/ADR-0006-knowledge-evidence-and-index-quality.md): model output cannot invent facts or citations. Facts retain typed source class/locator, a bounded PII-free evidence summary, ingestion time, nullable independent verification time, and a versioned review policy. Public eligibility additionally requires a private authenticated reviewer and bounded expiry. Retrieval accepts only `isEligiblePoiFact` results, citation ids are request-allowlisted, and no-match answers are explicit.
- Public fact provenance is derived only after `isEligiblePoiFact` succeeds. The accepted public source
  classes are `official`, `operator_verified`, and `reputable_editorial`; user reports, model output,
  uncorroborated scrapes, and raw merchant submissions cannot be upgraded by a presentation consumer.
  Public receipts may expose a source-class label and last-verified date, but never source locators,
  evidence summaries, reviewer identity, authorization state, or internal notes.
- A completion job carries only a Trip reference, base version, idempotency key, bounded attempt state, and safe error code. Its pure state-transition rule permits idempotent reads, `queued -> running`, a running terminal result, and `partial`/`failed -> queued` retry only. It never carries a prompt, model credential, or replacement Trip snapshot.
- Copilot observability records require exactly one trusted identity, a future retention deadline,
  normalized success/failure fields, and pre-persistence redaction. Domain validation rejects direct
  email/phone patterns, credential tokens, authorization values, cookies, signatures, and secret-like
  object keys; runtime redaction remains responsible for replacing detected content before parsing.
- Per-attempt cost records preserve provider-reported total input tokens plus a cached-input subset;
  cached tokens cannot exceed total input tokens. Cache-miss and cache-hit input prices are separate
  immutable snapshots. `cost_pricing_missing` is a retained product event, not permission to invent
  a price or silently treat a zero-price row as reconciled.
- Human Task status changes use `transitionHumanTask`; the generic update contract cannot carry a
  status. The canonical forward path is `requested -> triaged -> quoted -> payment_pending -> paid ->
fulfilling -> done`, with explicit cancellation edges and no terminal recovery. A transition reason
  is trimmed and bounded to 10-500 characters.
- Human Task evidence is typed as `outcome` or `transcript_excerpt` and is eligible only after
  `done` or `cancelled`. Email/phone data is replaced before persistence; credential, payment, OTP,
  and travel-document content is rejected.

## Change Workflow

1. Update or add the Zod schema.
2. Add pure behavior where the rule belongs in the domain.
3. Add tests for valid input, invalid input, and behavior boundaries.
4. Export through the module index and package index.
5. Update this document and any affected contract constraint.
6. Land breaking changes separately before app/server consumers.

## Verification

```bash
pnpm --filter @visepanda/domain typecheck
pnpm --filter @visepanda/domain test
pnpm --filter @visepanda/domain lint
```

Current test suites cover Trip patches, Copilot envelopes, knowledge derivation, task transitions,
commerce URL construction, events, and errors.
