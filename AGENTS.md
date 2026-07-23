# VisePanda V2 Agent Rules

This repository is the only development home for VisePanda V2. All work follows **JTCoding Skills**,
the renamed and expanded successor of the original 钱学森 Skills baseline. JTCoding combines
钱学森 systems engineering, Matt Pocock-inspired documentation-as-code, Karpathy coding discipline,
token-efficiency rules, and evidence-first acceptance. The canonical project methodology remains
defined in `docs/methodology/qian-systems-engineering.md`.

## JTCoding Skills

- Use JTCoding Skills for every coding, debugging, review, refactor, architecture, deployment, and
  planning task in this repository.
- JTCoding Skills supersedes the previous separate `qian-systems-engineering`,
  `karpathy-guidelines`, and Matt-inspired documentation skill usage. Do not invoke those older
  skills separately for this repository; treat them as internal layers of JTCoding.
- Prefer `$jtcoding-skills` when the native Codex skill is installed. The project-local toolchain is
  `.jtcoding-skills/`; do not run its `init.js` over this repository unless explicitly asked, because
  this repository already has mature governance docs that must not be overwritten.
- Before coding, load only the minimum context pack: `CONTEXT.md`, `docs/handoff.json`,
  `docs/manifest.json`, the current Issue, and real git status.
- State the control loop before implementation: objective `r`, observation `y`, reversible action
  `u`, and the deviation `e` being closed.
- Run the controllability/observability screen before accepting work. If there is no control lever or
  no observation, escalate to the operator instead of producing a mock that pretends to solve it.
- Apply the JTCoding red lines: no fabricated success, no mock presented as production, no
  `--no-verify`, no `as any`, no swallowed exceptions to turn checks green, and no bypass of
  security, permissions, payment, or data-integrity constraints.

## Read First

1. `CONTEXT.md`
2. `docs/INDEX.md` current handoff snapshot and mandatory reading order
3. `docs/architecture/top-level-design.md`
4. Relevant module, constraint, ADR, and runbook documents
5. The assigned GitHub Issue and current git state

Do not reread every document. Use the generated index to build the minimum authoritative context
pack. The frozen product baseline is `docs/planning/visepanda-v2-final-architecture.md`.

## JTCoding Control Loop

- Trace work to an accepted objective and subsystem.
- Treat the Issue as a small, reversible control action with explicit observations.
- Freeze schema/API/event/migration/state-machine interfaces before parallel consumer work.
- Classify discovered deviation: D0 accepted, D1 local, D2 cross-system review, D3 operator/baseline.
- For D2/D3, stop expanding implementation and escalate through contract review or ADR.
- Code, docs, tests, rollout/rollback, and learning are one deliverable.
- Multiple model answers are hypotheses, not votes or factual confirmation.

## JTCoding Implementation Discipline

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
