# Testing Standard

Status: active

## Test Layers

| Layer | Purpose | Required when |
| --- | --- | --- |
| Unit | pure rules, derivation, state transition, normalization | domain or branching logic changes |
| Contract | schema/API/event/provider boundary | interface baseline changes |
| Integration | service + adapter/database/route interaction | persistence, auth, webhook, migration changes |
| UI | user-visible state and interaction | public or Ops flow changes |
| Eval | AI quality, safety, structured output | prompt/model/router/retrieval changes |
| Smoke | deployed critical path | release candidate or deployment change |

## Rules

- Assert observable behavior, not implementation trivia.
- Every bug fix adds a regression test that fails before the fix when practical.
- Test success, expected failure, malformed input, empty/missing data, and authorization denial.
- Use deterministic fixtures. A test must not require a paid external API unless explicitly marked as
  a separate opt-in verification.
- Never make a failing test pass by restoring fabricated production fallback behavior.
- Migration tests must verify schema, constraints, RLS, and idempotent local reset/apply behavior.
- Runtime-mode tests must explicitly inject test/demo adapters and prove deployed modes do not silently
  select memory after missing configuration or dependency failure.
- AI eval output is evidence, not a substitute for schema and deterministic tests.

## Commands

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm evals
pnpm docs:check
```

Run the broadest relevant subset locally. CI remains authoritative. If a command cannot run, record
the exact command, error, and residual risk in the PR.
