# VisePanda V2 Agent Rules

This repository is the only development home for VisePanda V2. The frozen baseline is
`docs/planning/visepanda-v2-final-architecture.md`; agent work follows baseline §9.

## Read First

1. `README.md`
2. `docs/planning/visepanda-v2-final-architecture.md`
3. `docs/adr/README.md`
4. The GitHub issue assigned to you

## Branch and PR Discipline

- Work one issue at a time.
- Use `agent/<issue-slug>` branches unless the operator gives an exact branch name.
- Open PRs against the previous stacked branch or `main`, matching the issue sequence.
- One PR may change one module boundary, one contract, or one UI flow. Do not bundle unrelated cleanup.
- Fill every PR template section: contracts, tests, evals, commercial tracking, rollback.

## Schema First

- Domain changes start in `packages/domain`: zod schema, pure function, unit test.
- Consumers in `apps/*` or `packages/api-client` follow after the schema compiles.
- Do not duplicate domain enums in UI/server files unless the values are imported from `@visepanda/domain`.

## Data and AI Boundaries

- AI output is a typed envelope plus TripPatch. AI never writes user data directly.
- Trip writes must flow through deterministic patch application.
- Prompt/model/router changes require the relevant eval command and pasted output in the PR.
- Runtime AI calls must be traceable through `agent_runs`/`tool_calls` when that path is active.

## Commercial Tracking

- Any money-adjacent feature needs a ledger or explicit telemetry event plan.
- Outbound links must go through the outbound gateway, not raw partner links.
- Payment work must state whether it is real collection, manual quote, or placeholder.
- No commercial UI ships without disclosure text and a rollback path.

## Operational Safety

- Keep migrations append-only. Never rewrite an existing migration after it has landed.
- If local Supabase is unavailable, say so in the PR instead of claiming a migration was applied.
- Do not add dashboards before the baseline trigger says they are needed; materialize data first.
- Missing data is shown as missing. Do not fabricate POI facts, prices, ratings, commissions, or booking states.

## Required Checks

Run the broadest relevant subset before pushing. For stacked baseline work, prefer:

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test && pnpm evals
```

If you cannot run a check, record the blocker and the exact command in the PR.
