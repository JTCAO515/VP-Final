# ADR-0015: Public Runtime Safety Uses One Bounded, Truthful Control Plane

Date: 2026-07-28

Status: Accepted

Decider: independent architecture owner through Issue #157 / P0-20

Owner: runtime safety / privacy

Decision date: 2026-08-12

## Context

Phase 0 has already landed several narrow public safeguards: the signed-anonymous three-turn wall,
trusted-network Copilot rate limit, public telemetry dual limiter, per-provider output limits,
daily cost observation, and Shanghai-wide Human Help daily capacity. They were intentionally built by
their owning subsystems. Treating P0-20 as a reason to add another generic limiter, a second cost
ledger, or a fake health success path would make enforcement inconsistent and obscure the true source
of an unavailable response.

The remaining gap is one reviewed runtime control plane for bounded Copilot input/output, authenticated
request abuse, Human Help concentration, safe error observation, and truthful public recovery states.
The daily cost observation is an operations signal; it is not a traveler charge or an automatic
shutdown policy.

## Decision

### Preserve existing owners

- The anonymous three-completed-turn wall remains owned by the signed-anonymous Upstash counter.
- The Copilot trusted-network guard remains `10/minute` and `60/hour` by default, using only
  Vercel's trusted address header and the existing HMAC/Redis control path.
- The telemetry endpoint retains its separate higher-density dual identity/network guard. P0-20 does
  not alter telemetry actions, retention, or producer semantics.
- The Shanghai controlled-preview global Human Help capacity remains five new tasks per China day.
- `VISEPANDA_DAILY_LLM_BUDGET_USD` remains an optional operations-only observation. Crossing it writes
  at most the existing `daily_budget_exceeded` event; it must not reject a traveler, collect money,
  imply billing, or claim an automatic shutdown.

### Add only the missing bounded controls

- A Copilot message is limited to 8,000 JavaScript string code units at the public boundary. The
  server-only `VISEPANDA_COPILOT_MAX_INPUT_CODE_UNITS` setting may lower that bound but must be an
  integer from 1 through 8,000. The route returns a typed non-success before model composition when
  the bound is exceeded.
- Every model attempt is clamped by a server-owned P0-20 hard ceiling of 1,600 output tokens. The
  server-only `VISEPANDA_COPILOT_MAX_OUTPUT_TOKENS` setting may lower that ceiling but must be an
  integer from 1 through 1,600; it cannot raise it. Provider-specific limits continue to apply as the
  stricter bound.
- Verified authenticated identities receive a separate HMAC-keyed Upstash request window of
  `20/minute` and `120/hour` by default. The server-only
  `VISEPANDA_AUTHENTICATED_RATE_LIMIT_MINUTE` and `VISEPANDA_AUTHENTICATED_RATE_LIMIT_HOUR` settings
  may lower their corresponding values but must be integers from 1 through 20 and 1 through 120.
  Their Redis key is an HMAC of a domain-separated authenticated-identity value using the existing
  server-only `VISEPANDA_IP_HASH_SALT`; it contains neither a raw user id nor an address. This protects
  an account that rotates networks while the lower trusted-network guard still protects a shared
  network. Anonymous users remain governed by their existing wall and network guard; no client counter
  or request-body identity is trusted.
- One verified identity may create at most one new Human Help task per China day. This is a fixed
  controlled-preview limit; a future change requires a D2 amendment rather than an environment edit.
  An idempotent replay of the same request remains a replay, not an additional submission. The global
  five-task capacity remains the final service-capacity guard.

All new numeric values are server-only environment policies with validated ranges. They may become
stricter through configuration but may not exceed the stated hard ceiling or silently fall back to
process-local enforcement in a deployed mode.

### Health, errors, and observation

- ADR-0005 remains the readiness authority: missing or failed required dependencies return typed
  `unavailable` results, optional observation failures preserve the primary result and emit only a
  safe failure class.
- A Web error boundary shows a recovery state with a generated safe correlation id. It never renders
  raw error text, stack traces, prompts, cookies, tokens, provider payloads, or credentials.
- Server route errors log only the safe correlation id, route/capability class, and normalized failure
  class. They never log request bodies, raw identity, client address, secret, cookie, signature, model
  payload, or cost row.
- Sentry may be used only as an optional server-side reporter when explicitly configured. Missing
  configuration leaves structured safe logging active and must not crash the application. Selecting an
  account, region, sampling, retention, and alert owner remains OA-008; a package installation is not
  production-observability evidence.
- P0-20 does not add a public provider-health dashboard or a successful fallback response. The existing
  typed route result is the user-facing health statement for the requested capability.

### Scope boundary

This decision does not introduce a payment quota, a user-visible cost meter, a CAPTCHA, a new generic
event type, an Ops bypass, an automatic daily-budget shutdown, or a new external monitoring account.
Payment and Human Task quote/completion signals remain deferred under P0-17 / OA-006 and ADR-0013.

## Consequences

- P0-20 may implement one small policy module and inject it through existing Web/server composition;
  it must reuse the existing Redis, identity, model, and Human Task service owners.
- Tests must demonstrate pre-model rejection for an oversized message, output-clamp behavior,
  authenticated identity-window exhaustion, same-day Human Help identity cap, idempotent replay,
  truthful 429/503/error-boundary states, and absence of sensitive data in reporter payloads.
- The new deployment settings must be named in the deployment constraint and OA-008/register material,
  but no value is committed. A missing required enforcement dependency is fail-closed.
- A future change to any hard ceiling, public recovery copy, cost action, identity source, or Sentry
  data boundary is a D2 amendment, not an ordinary environment tweak.

## Alternatives Considered

### Add a separate P0-20 ledger or generic rate limiter

Rejected. It would duplicate authoritative costs/events and create a competing production enforcement
path.

### Automatically stop all Copilot traffic after the daily cost warning

Rejected. The accepted daily budget event is an operations observation, not a charge, entitlement, or
verified outage signal. Automatic shutdown would be a new public availability promise and requires a
separate commercial/runtime decision.

### Trust browser counters or `x-forwarded-for`

Rejected. Both are spoofable and conflict with ADR-0004 and the accepted Vercel trust boundary.

### Make Sentry mandatory before error handling exists

Rejected. A missing third-party monitoring setting must not remove truthful local error behavior or
crash preview/production routes.

## Verification

- Unit and route tests cover every numeric-policy boundary and fail-closed missing dependency behavior.
- Browser tests cover the error boundary and limit/retry states without exposing sensitive diagnostics.
- Deployment review confirms only setting names, safe error behavior, and an OA-008 state; it does not
  claim a live monitoring account or alert until the operator records sanitized external evidence.
- The affected Database contracts suite is rerun after the separate deterministic-trigger-cleanup
  control action; a rerun alone is not evidence that the test deadlock is resolved.

## Rollback

Lower a configured bound or disable the optional Sentry reporter, then redeploy. If a required Redis
or trusted-header dependency is unavailable, keep the affected capability honestly unavailable; do
not restore a process-local production fallback or emit a fabricated answer. A hard-ceiling change
requires a reviewed forward amendment to this ADR.
