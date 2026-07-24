# ADR-0010: Copilot Cost Accounting Contract

Date: 2026-07-24
Status: Accepted
Decider: architecture owner through Issue #248
Owner: AI platform / data platform
Review date: 2026-08-24, or before changing a production provider price or retention policy

## Context

Provider invoices distinguish cache-miss input, cache-hit input, and output tokens. The first cost
schema stored only total input tokens and one input price, so it could not explain cache savings or
reconcile provider statements. A second lifecycle conflict linked the 400-day cost ledger to a
30-day Agent Trace through `on delete cascade`, causing valid financial evidence to expire with
debugging metadata.

## Decision

Each provider attempt stores provider-reported total input, cached-input, and output tokens. Missing
cache detail is zero, which conservatively prices all input as cache miss. Failed calls store only
usage actually reported by the provider; network failures without usage store zero and are never
estimated.

Pricing comes from the versioned registry in `packages/ai`, keyed by provider and model. Every cost
row snapshots the effective cache-miss input, cache-hit input, and output prices. A missing registry
entry writes all three prices as zero and emits `cost_pricing_missing`; it is never silently treated
as trustworthy zero cost.

The deterministic cost formula is:

```text
uncached_input_tokens = input_tokens - cached_input_tokens
cost_usd =
    uncached_input_tokens * input_miss_price / 1_000_000
  + cached_input_tokens   * input_hit_price  / 1_000_000
  + output_tokens         * output_price     / 1_000_000
```

Calculation uses fixed-point decimal arithmetic and HALF_UP rounding to eight decimal places. Runtime
effort records the actual request value; router/extraction `low`, concierge `medium`, and planning
`high` are defaults only.

Conversation content defaults to 180-day retention, costs to 400 days, and product events to 180
days. Writers calculate explicit deadlines from separate positive-integer server settings.

`llm_call_costs.agent_run_id` remains a non-null, immutable UUID. A `before insert` trigger locks and
validates that the Agent Run exists at write time. There is deliberately no continuing foreign key:
when `internal.purge_expired_agent_traces()` removes the 30-day parent, the cost row retains its
opaque historical correlation id until its own deadline. This expected dangling reference is not
data corruption. `internal.purge_expired_copilot_observability()` independently removes expired cost
rows. Aggregate cost views must not join Agent Trace data.

## Consequences

- Financial reconciliation survives privacy-driven trace deletion.
- New cost rows cannot begin orphaned, and their run correlation cannot be rewritten.
- Historical rows preserve the prices used at call time when the registry changes.
- Missing pricing and missing cache telemetry remain visible and conservative.
- The conversation-to-run nullable `on delete set null` relationship is unchanged because it is not
  a financial ledger boundary.

## Verification

- Unit tests cover pure miss, pure hit, mixed, no-cache-detail, and missing-pricing behavior.
- Provider fixtures cover DeepSeek cache-hit tokens and OpenAI-compatible cached-token details for
  Qwen, Kimi, and GLM, with zero fallback when absent.
- pgTAP proves valid insertion, orphan rejection, immutable run ids, parent deletion survival, and
  independent trace/cost purge deadlines.
- Persistence tests prohibit provider keys, cookies, signatures, raw IP addresses, and unredacted
  contact or identity content.

## Rollback

Disable runtime persistence without changing Copilot response behavior. Repair accounting defects
with a new forward migration. Do not restore cascade deletion, rewrite applied migrations, estimate
provider usage, or mutate historical price snapshots.
