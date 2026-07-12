# AI Provider Configuration Runbook

## When to Use

Use this runbook when a trusted operator prepares a preview, staging, or production environment for
real Copilot model calls. It supports the bounded OpenAI-compatible adapter introduced by P0-07a
#187. The adapter is not connected to a public Copilot route until P0-07b #188 is accepted.

## Preconditions

- Read [ADR-0005](../adr/ADR-0005-runtime-modes-and-production-adapter-ownership.md), the [AI module
  document](../modules/ai.md), and [OA-005](../governance/operator-action-register.md).
- Obtain an approved provider account, a spending limit, and an environment-specific secret store.
- Do not put keys in the repository, Issue, PR, CI logs, browser bundle, screenshots, or test
  fixtures.
- Begin in preview or staging. A real call is evidence only after the operator records the target
  environment, date, verifier, and sanitized result in OA-005.

## Configuration Names

Set one complete slot for a primary provider and, only when intentionally configured, one for a
fallback provider:

| Slot     | Required names                                                                                   | Optional bounded names                                                 |
| -------- | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Primary  | `VISEPANDA_AI_PRIMARY_BASE_URL`, `VISEPANDA_AI_PRIMARY_API_KEY`, `VISEPANDA_AI_PRIMARY_MODEL`    | `VISEPANDA_AI_PRIMARY_TIMEOUT_MS`, `VISEPANDA_AI_PRIMARY_MAX_TOKENS`   |
| Fallback | `VISEPANDA_AI_FALLBACK_BASE_URL`, `VISEPANDA_AI_FALLBACK_API_KEY`, `VISEPANDA_AI_FALLBACK_MODEL` | `VISEPANDA_AI_FALLBACK_TIMEOUT_MS`, `VISEPANDA_AI_FALLBACK_MAX_TOKENS` |

The adapter posts only to `<BASE_URL>/chat/completions`, uses bearer authentication, and requests a
JSON object. It normalizes upstream status/body/network failures to safe failure classes; it does not
log an upstream response body. A missing required name must leave that provider unavailable rather
than fabricate a response.

## Steps

1. In the deployment platform's server-side environment settings, add the required names for the
   selected slot. Do not add them to any client-exposed environment namespace.
2. Optionally set positive integer timeout and token ceilings. Omitted, zero, negative, or invalid
   values use the repository defaults (`12000` ms and `1200` tokens). The router also enforces its
   total attempt budget.
3. Deploy to preview/staging with the explicit runtime mode required by ADR-0005. Do not use
   `local-demo` as a production fallback.
4. Once P0-07b is accepted, make one sanitized staging request through the Copilot route. Check
   that the response is typed, failures are honest, and no secret or raw provider payload appears in
   trace/log output.
5. Record only the setting names, provider label, model label, target environment, date, verifier,
   and observed behavior in OA-005. Never record a value or copy a request authorization header.

## Verification

Before an external call, run the repository checks:

```bash
pnpm --filter @visepanda/ai typecheck
pnpm --filter @visepanda/ai test
pnpm evals
```

For a configured deployment, the expected result is either a typed structured response or a
sanitized, visible unavailable/failure state. A mock, static, or fixture response is not real-provider
evidence.

## Rollback

1. Remove the affected provider slot from the trusted deployment secret store and redeploy.
2. Keep the Copilot capability honestly unavailable; do not switch a deployed environment to a mock
   or `local-demo` mode as a disguised rollback.
3. If exposure is suspected, revoke the provider credential in the provider console, create a fresh
   credential, and record the incident without including either secret.

## Notes

- P0-07a #187 delivers the adapter and configuration contract only.
- P0-07b #188 owns runtime composition, structured Copilot wiring, and any later real-call evidence.
- Provider names are intentionally generic. Selecting or changing a vendor is an operator decision,
  not an implicit repository default.
