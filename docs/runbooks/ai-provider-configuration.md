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

## Build Environment Contract

Turborepo runs in strict environment mode. The root `turbo.json` therefore declares the server-only
variables needed by the Web, server, and Ops build tasks in `globalEnv`. This has two purposes:

- the configured variables are available to the task that builds the deployment; and
- a change to their values invalidates the affected build cache rather than reusing an artifact built
  with a different runtime contract.

The allowlist contains only variable **names**. It includes database and signed-anonymous-session
configuration, the explicit runtime mode, the four provider key/base-URL pairs, `VISEPANDA_MODEL_*`,
and `PLANNING_REWRITE_ENABLED`. It must never contain a secret value, and `NEXT_PUBLIC_*` is not an
alternative for server credentials.

When adding a new server environment variable that changes build or runtime behavior, add its name to
the root `globalEnv` list in the same PR, update this runbook, and redeploy the target environment.
Do not use Turborepo loose mode or `passThroughEnv` to silence a missing-variable warning: both weaken
the cache and configuration contract this runbook is meant to preserve.

## DEMO-01 v3 Inventory

Use only catalog-verified model names in `VISEPANDA_MODEL_*` route variables. Every configured route
also needs its provider's server-side key and may override its documented base URL with the matching
`*_BASE_URL` variable. The adapter posts only to `<BASE_URL>/chat/completions`, uses bearer
authentication, requests a JSON object, normalizes upstream failures, and never logs upstream bodies.

| Chain               | Route variable                                                                                                  | Provider credential                                     | Required demo order                                 |
| ------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------------- |
| Low intent router   | `VISEPANDA_MODEL_ROUTER_PRIMARY`, `VISEPANDA_MODEL_ROUTER_FALLBACK`                                             | `DASHSCOPE_API_KEY`, `DEEPSEEK_API_KEY`                 | Qwen Flash, then DeepSeek V4 Flash                  |
| Medium concierge    | `VISEPANDA_MODEL_CONCIERGE_PRIMARY`, `VISEPANDA_MODEL_CONCIERGE_FALLBACK`, `VISEPANDA_MODEL_CONCIERGE_TERTIARY` | `MOONSHOT_API_KEY`, `ZHIPU_API_KEY`, `DEEPSEEK_API_KEY` | Kimi K2.6, GLM 5.2, then DeepSeek V4 Pro            |
| High planning       | `VISEPANDA_MODEL_PLANNING_PRIMARY`, `VISEPANDA_MODEL_PLANNING_FALLBACK`                                         | `DEEPSEEK_API_KEY`, `MOONSHOT_API_KEY`                  | DeepSeek V4 Pro, then Kimi K2.6                     |
| Deferred extraction | `VISEPANDA_MODEL_EXTRACTION_PRIMARY`                                                                            | `DASHSCOPE_API_KEY`                                     | Qwen Plus; configuration only, not wired in DEMO-01 |

The four trusted server-side key names are `DASHSCOPE_API_KEY`, `DEEPSEEK_API_KEY`,
`MOONSHOT_API_KEY`, and `ZHIPU_API_KEY`. `PLANNING_REWRITE_ENABLED` stays false unless explicitly
set to `true`; it remains off for the financing demo to enforce one main model call per turn.

## Steps

1. In the deployment platform's server-side environment settings, add all selected route model names,
   their provider credentials, and an explicit non-demo runtime mode. Ensure each intended target has
   the matching variables; a production-only runtime mode does not create a valid Preview/staging
   verification target. Do not add them to any client-exposed environment namespace.
2. Keep `PLANNING_REWRITE_ENABLED` absent or `false` for the demo. The runtime uses a 20 second
   per-provider ceiling inside a 25 second router budget; do not claim a latency target until OA-005
   records a measured call.
3. Deploy to preview/staging with the explicit runtime mode required by ADR-0005. Check the build log
   has no Turborepo warning that a listed server variable is unavailable to the application. Do not use
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

- The repository uses fixed v3 provider roles, but each concrete model id remains an operator-selected,
  catalog-confirmed environment value. Deprecated aliases must not be introduced in source code.
- A missing route or key remains a typed 503 and is never replaced with mock text outside `local-demo`
  or tests.
