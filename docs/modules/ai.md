# AI Module

Path: `packages/ai`

## Responsibility

The AI package defines provider-neutral model routing, effort levels, token usage, cost calculation,
fallback attempts, and the cost-ledger interface. Prompt profiles and concrete providers belong here
when implemented.

## Implemented

- Task classes: router, Trip writer, knowledge QA, and commerce/human handoff.
- Effort levels: low, medium, and high.
- Ordered provider fallback.
- Per-attempt success/failure capture.
- Token and cost calculation from provider pricing.
- In-memory cost ledger for tests.
- Static provider for deterministic tests.

## Not Yet Production-Implemented

- Real provider HTTP clients and secret-backed configuration.
- Prompt profile versioning.
- Structured Copilot envelope generation and repair in this package.
- Persistent model attempt, tool-call, latency, and cost traces are implemented through the server
  Trace service and Postgres adapter; real provider attempts remain P0-07 work.
- Rate limits and entitlement-aware budgets.

## Constraints

- Provider-specific behavior is isolated behind `ModelProvider`.
- A provider failure may trigger the next configured provider; all failures produce an honest error.
- Missing keys or total provider failure must not return a fabricated answer.
- Prompt, model, routing, parser, or tool changes require relevant evals.
- Logs and traces must redact secrets and sensitive user content.
- Cost records are measurements, not billing ledgers.
- Trace storage follows [ADR-0007](../adr/ADR-0007-agent-trace-privacy-retention.md): it stores only
  allowlisted metadata and digests, never raw model/tool payloads, and has a 30-day retention deadline.

## Verification

```bash
pnpm --filter @visepanda/ai typecheck
pnpm --filter @visepanda/ai test
pnpm evals
```
