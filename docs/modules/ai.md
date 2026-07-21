# AI Module

Path: `packages/ai`

## Responsibility

The AI package defines provider-neutral model routing, effort levels, token usage, cost calculation,
fallback attempts, the cost-ledger interface, and bounded provider adapters. Prompt profiles and
Copilot-specific provider composition belong in their owning runtime module.

## Implemented

- Task classes: router, Trip writer, knowledge QA, and commerce/human handoff.
- Effort levels: low, medium, and high.
- Ordered provider fallback.
- Per-attempt safe success/failure metadata, including route, actual provider, bounded latency,
  normalized failure class, runtime effort, fallback attribution, and an exact cost snapshot.
- Token and cost calculation from provider pricing.
- A versioned `(provider, model)` USD pricing registry and BigInt fixed-point three-part cost
  calculation for cache-miss input, cache-hit input, and output tokens. The result is rounded HALF_UP
  to the ledger's eight-decimal scale.
- In-memory cost ledger for tests.
- Static provider for deterministic tests.
- OpenAI-compatible adapter contract: bounded JSON-object request, per-attempt timeout cap,
  abortable timeout, safe response parsing, and no upstream-body leakage.
- Cache-hit usage normalization: DeepSeek reads `usage.prompt_cache_hit_tokens`; DashScope,
  Moonshot, and Zhipu read `usage.prompt_tokens_details.cached_tokens`. Missing, malformed,
  negative, non-integer, or greater-than-total values become zero so accounting conservatively
  treats all input as cache misses.
- Environment resolver for intentionally configured primary/fallback provider slots. It reports an
  incomplete slot as unavailable and does not choose a vendor or make a network call by itself.
- DEMO-01 v3 provider inventory for DashScope, DeepSeek, Moonshot, and Zhipu. Route model names
  are environment-selected and readiness diagnostics never expose key values. Moonshot, DeepSeek,
  and Zhipu routes inject their documented non-thinking request body because DEMO-01 expects short
  JSON envelopes rather than reasoning traces.

## Not Yet Production-Implemented

- Real provider configuration and live-model acceptance evidence. DEMO-01 composes v3 routes through
  the server pipeline only outside explicit `test` and `local-demo` modes; absent route configuration
  returns a typed unavailable error instead of a deterministic answer.
- Real provider account/setup and staging evidence (OA-005); this repository does not claim a live
  provider merely because the adapter can be configured.
- Prompt profile versioning.
- Structured Copilot envelope generation and repair in this package.
- Persistent model attempt, tool-call, latency, and cost traces are implemented through the server
  Trace service and Postgres adapter; real provider attempts remain P0-07 work.
- Rate limits and entitlement-aware budgets.

## Constraints

- Provider-specific behavior is isolated behind `ModelProvider`.
- A provider failure may trigger the next configured provider; all failures produce an honest error.
- A route-level router budget is a total ceiling, not permission for one provider to consume the
  whole chain. The adapter must cap each attempt at the provider's configured timeout so fallback
  providers can still execute within the total budget.
- Missing keys or total provider failure must not return a fabricated answer.
- DEMO-01 accepts a bounded locally repaired JSON candidate only after `CopilotEnvelopeSchema` passes.
  It permits dialogue only: no Trip actions, tools, commerce, Human Help, or citations. A main-model
  envelope whose intent differs from the low-cost router decision fails closed.
- Provider setup follows the [AI provider configuration runbook](../runbooks/ai-provider-configuration.md)
  and the operator-action register. Keys remain trusted runtime configuration only.
- Prompt, model, routing, parser, or tool changes require relevant evals.
- Logs and traces must redact secrets and sensitive user content.
- Cost records are measurements, not billing ledgers.
- Runtime model ids remain environment-selected. The pricing registry resolves exact catalog ids and
  never guesses aliases. Moonshot Kimi K2.6 and DeepSeek V4 Flash/Pro carry official-source USD
  snapshots for operator verification during review; DashScope and Zhipu remain intentionally
  unregistered until an approved USD snapshot exists, so a later writer must emit
  `cost_pricing_missing` rather than invent an FX conversion.
- The router snapshots the registry's three prices and the provider-reported total/cached/output
  token counts for every attempt, then calls the fixed-point three-part calculator. The legacy
  numeric cost remains compatibility metadata only; durable accounting must consume the exact
  eight-decimal string in the snapshot. A failed attempt without provider usage records zero rather
  than estimating tokens.
- The four cache-field mappings are covered by contract fixtures, not retained sanitized production
  responses. They remain **unobserved in production; conservative zero applies** when the expected
  field is absent or invalid. Live-provider evidence must be reported separately and must not contain
  prompts, responses, or credentials.
- Trace storage follows [ADR-0007](../adr/ADR-0007-agent-trace-privacy-retention.md): it stores only
  allowlisted metadata and digests, never raw model/tool payloads, and has a 30-day retention deadline.
- Retrieval context contains only currently eligible reviewed POI facts. Model citations are validated
  against that per-request allowlist; labels and sources are derived from facts, never trusted from
  model output. A no-evidence answer remains explicit rather than speculative.

## Verification

```bash
pnpm --filter @visepanda/ai typecheck
pnpm --filter @visepanda/ai test
pnpm evals
```
