# VisePanda V2 Agent Rules

This repository is the only development home for VisePanda V2. All work follows the composite
**钱学森 Skills + Matt Pocock-inspired documentation-as-code + Karpathy coding discipline** baseline
defined in `docs/methodology/qian-systems-engineering.md`.

## Read First

1. `CONTEXT.md`
2. `docs/INDEX.md` current handoff snapshot and mandatory reading order
3. `docs/architecture/top-level-design.md`
4. Relevant module, constraint, ADR, and runbook documents
5. The assigned GitHub Issue and current git state

Do not reread every document. Use the generated index to build the minimum authoritative context
pack. The frozen product baseline is `docs/planning/visepanda-v2-final-architecture.md`.

## 钱学森 Skills Control Loop

- Trace work to an accepted objective and subsystem.
- Treat the Issue as a small, reversible control action with explicit observations.
- Freeze schema/API/event/migration/state-machine interfaces before parallel consumer work.
- Classify discovered deviation: D0 accepted, D1 local, D2 cross-system review, D3 operator/baseline.
- For D2/D3, stop expanding implementation and escalate through contract review or ADR.
- Code, docs, tests, rollout/rollback, and learning are one deliverable.
- Multiple model answers are hypotheses, not votes or factual confirmation.

## Karpathy Coding Discipline

- Before coding, inspect the authoritative context and state assumptions that can affect behavior.
- Resolve low-risk ambiguity with an explicit, reversible assumption. Ask the operator when ambiguity
  can change a contract, permission boundary, money flow, data ownership, public promise, or
  irreversible outcome.
- Choose the smallest implementation that satisfies the Issue and frozen interfaces. Do not add
  speculative features, abstractions, configurability, dependencies, or impossible-state handling.
- Make surgical changes. Every changed line must trace to the Issue, acceptance evidence, or cleanup
  caused by the change; do not refactor adjacent code or delete pre-existing dead code.
- Match established local style and remove only artifacts made unused by the current change.
- Bind every implementation step to a reproducible check and continue until acceptance passes or an
  honest blocker is recorded.
- When simplicity conflicts with security, privacy, data/payment integrity, accepted contracts, or
  repository constraints, the stricter system invariant wins.

## Branch and PR Discipline

- Work one issue at a time.
- Use the branch name assigned by the operator; otherwise follow the active repository convention.
- Open PRs against the previous stacked branch or `main`, matching the issue sequence.
- One PR may change one module boundary, one contract, or one UI flow. Do not bundle unrelated cleanup.
- Fill every PR template section: contracts, tests, evals, commercial tracking, rollback.
- Update at least one mapped non-generated document for every source/config change.
- Update `docs/handoff.json` for every repository change and regenerate `docs/INDEX.md`.
- An implementation Agent MUST NOT approve or merge its own PR. After all required checks are green,
  mark the PR ready, request architecture review, record the evidence, and stop. Only the
  architecture owner or operator may merge; D2/D3 changes require the invariant review defined in
  `docs/governance/issue-pr-workflow.md`.

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

## Operator-Only Actions

- External console, account, credential, legal, DNS, deployment, store, or production-setting work
  MUST be recorded in `docs/governance/operator-action-register.md`; chat history is not a register.
- Code and docs use named placeholders only. Never request, print, commit, log, or paste a secret into
  an Issue, PR, tutorial, screenshot, or repository file.
- A placeholder remains `open` until real external evidence is recorded. Mock, local adapter, or UI
  evidence MUST NOT be presented as proof that the third-party capability is live.
- When an objective completes or the operator asks, use
  `docs/governance/operator-action-tutorial-template.md` to produce beginner-friendly Chinese steps
  for every unresolved action, including verification, rollback, and common mistakes.

## Required Checks

Run the broadest relevant subset before pushing. For stacked baseline work, prefer:

```bash
pnpm typecheck && pnpm lint && pnpm build && pnpm test && pnpm evals
pnpm docs:index && pnpm docs:check
pnpm docs:impact -- --base origin/main
```

If you cannot run a check, record the blocker and the exact command in the PR.
