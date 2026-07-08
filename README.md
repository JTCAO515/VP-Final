# VisePanda V2 (VP-Final)

**The execution copilot for foreigners in China.**
规划免费，执行可靠，出事有人管 — planning is the free hook; the product is reliable
in-China execution (payments, network, language, transport, bookings) with a paid human
fallback and custom-trip lead generation on top.

## Start here

1. Read the frozen baseline: [`docs/planning/visepanda-v2-final-architecture.md`](docs/planning/visepanda-v2-final-architecture.md)
   — the single planning input for this repo. Amendment rules are in its Appendix A.
2. Read [`docs/adr/`](docs/adr/) for decisions already made. Do not relitigate them in PRs.
3. Pick up the next open issue (they follow the baseline §8 twenty-issue bootstrap list, in order).

## Repo layout

```
packages/domain      single source of truth: zod schemas + pure functions (change this FIRST)
packages/api-client  typed client generated from the server router
packages/ai          prompt profiles, model routing, output validation, evals glue
packages/ui          design tokens + shared primitives
apps/web             Next.js — SEO + full web product (placeholder until Issue #10)
apps/mobile          Expo RN — in-China execute app (placeholder until Phase 1)
apps/server          modular monolith API (placeholder until Issue #5)
apps/ops             operator console: knowledge editing, task dispatch (placeholder)
infra/               migrations, seeds, deploy config
evals/               golden sets + regression runners for AI behavior
```

## Development rules (hard gates)

- **Schema first.** Any feature that touches domain models changes `packages/domain` in a
  standalone PR (schema + pure functions + unit tests) before any consumer PR.
- **One PR, one boundary.** One module, or one contract change, or one UI flow.
- **AI never writes data.** Model output is a typed envelope + patches; deterministic code
  validates and applies. Chat carries commercial links only on explicit commerce intent.
- **Money hits the ledger.** Any paid/commercial behavior emits ledger + telemetry events,
  with tests.
- **Prompt changes ship with evals.** CI's evals gate becomes required once `packages/ai`
  has its first profile.

## Quickstart

```bash
pnpm install
pnpm build && pnpm test && pnpm typecheck && pnpm lint
```

Node >= 20, pnpm 9 (`npm i -g pnpm@9`).
