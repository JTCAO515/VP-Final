# JTCoding Engineering Baseline

Status: active
Owner: overall design
Applies to: Codex, Claude Code, human contributors, and every VisePanda change

## Purpose

VisePanda uses **JTCoding Skills** as one engineering baseline. The previous Qian
systems-engineering workflow, Matt-inspired documentation-as-code practice, and Karpathy coding
discipline are now internal layers of JTCoding, not separate skills to invoke for new project work.

| Layer | Responsibility | Failure it prevents |
| --- | --- | --- |
| Systems engineering | Objective traceability, subsystem decomposition, interface freeze, lifecycle gates, feedback, deviation correction, and knowledge archival | Local delivery that drifts from product/commercial goals |
| Documentation-as-code | Short agent entry points, durable context, document registry, generated Index, handoff snapshot, and code/document synchronization | Stale documentation, repeated exploration, and private-chat dependency |
| Focused coding discipline | Explicit assumptions, minimum sufficient design, surgical diffs, and goal-driven verification | Overengineering, scope creep, hidden guesses, and weak acceptance |

The layers have different jobs. Model agreement is not a vote, a document is not runtime evidence, and
simple code is not permission to bypass security or contracts.

## Source and Installation Record

- Current global JTCoding Skill: `~/.codex/skills/jtcoding-skills/`
- Current project-local JTCoding toolchain: `.jtcoding-skills/`
- Legacy global Qian Skill: `~/.codex/skills/qian-systems-engineering/` (historical source only)
- Legacy global Karpathy Skill: `~/.codex/skills/karpathy-guidelines/` (historical source only)
- Karpathy upstream: <https://github.com/multica-ai/andrej-karpathy-skills>
- Verified upstream commit: `2c606141936f1eeef17fa3043a72095b4765b9c2`
- Karpathy Skill path: `skills/karpathy-guidelines/SKILL.md`
- Karpathy Skill license declaration: MIT
- Portable export: `钱学森Skills/` and `钱学森Skills.zip` in the operator workspace

Repository rules remain authoritative for VisePanda. JTCoding supplies the current default method; no
older Qian, Matt-inspired, or Karpathy skill should be invoked separately for this repository unless
the operator explicitly requests a historical audit.

## Authority and Precedence

Apply the strictest compatible rule in this order:

1. security, privacy, authorization, data/payment integrity, production truthfulness, and legal rules;
2. repository-local `AGENTS.md`, active constraints, accepted ADRs, and frozen product/architecture;
3. assigned GitHub Issue scope, do-not-touch boundary, and executable acceptance;
4. JTCoding lifecycle, documentation, and evidence controls;
5. JTCoding simplicity and surgical-change guidance;
6. optional style preferences.

Conflicts affecting contracts, permissions, money, data ownership, public promises, or irreversible
outcomes are D2/D3 and require accountable human resolution.

## Mandatory Reading Order

Start with `docs/INDEX.md`, which renders the current snapshot from `docs/handoff.json`. The baseline
reading route is:

1. `AGENTS.md`
2. `CONTEXT.md`
3. `docs/INDEX.md` current phase, active work, blockers, verification, and next actions
4. `docs/architecture/top-level-design.md`
5. `docs/methodology/qian-systems-engineering.md`
6. `docs/planning/visepanda-v2-final-architecture.md`
7. latest dated project review
8. relevant module document
9. relevant constraint, ADR, and runbook
10. assigned Issue and current git state

Do not read the entire repository by default. Build the minimum authoritative context pack.

## Document System

### Explanatory documents

Explain current product intent, system behavior, module ownership, maturity, flows, and operations.
They must distinguish implemented, demo/mock, degraded, planned, and historical behavior.

### Constraint documents

Use MUST/MUST NOT/MAY language, identify owner, verification, evidence, exception, and rollback. A
constraint without an enforcement/review path is incomplete.

### Decisions and history

ADRs are append-only. Supersede old decisions rather than rewriting history. Dated planning and
research documents retain status and are not treated as current runtime truth.

### Registry and Index

- `docs/manifest.json` registers every controlled Markdown document and source mapping.
- `docs/handoff.json` records current phase, maturity, active work, blockers, verification, next
  actions, and reading order.
- `docs/INDEX.md` is generated; never hand-edit it.
- Every repository change updates handoff, regenerates Index, and updates the smallest explanatory or
  constraint document that would otherwise become false.

## Mandatory Work Loop

```text
G0 objective + observation + assumptions
  -> G1 subsystem decomposition + interface freeze
  -> G2 executable GitHub Issue
  -> JTCoding minimum design + success criteria
  -> G3 focused code + tests + synchronized docs
  -> G4 verification from unit to production observation
  -> G5 D0-D3 deviation classification and correction
  -> G6 retrospective + Index/handoff/knowledge archival
```

An Issue must be executable without private chat and include objective, subsystem, deviation, scope,
do-not-touch, dependencies, interface/data/permission/commercial impact, acceptance, tests,
documentation impact, observation window, risk, rollback, and size. Work above five focused days must
be split.

## JTCoding Implementation Gate

Before coding:

1. State material assumptions and competing interpretations.
2. Resolve discoverable facts from code/docs first.
3. Use an explicit reversible assumption for low-risk ambiguity.
4. Ask the operator for high-risk ambiguity.
5. Define the smallest sufficient behavior and executable success criteria.

During coding:

- no unrequested feature, speculative flexibility, premature abstraction, or unrelated cleanup;
- every changed line traces to Issue scope, acceptance, or cleanup caused by the change;
- match local style and ownership;
- remove only artifacts made unused by this change;
- bind each step to a test, command, fixture, screenshot, query, or runtime observation.

Before merge, review any unexpectedly large or abstract diff and reduce it or justify why system
constraints require the complexity.

## Verification Baseline

Run the broadest relevant subset:

```bash
pnpm typecheck
pnpm lint
pnpm build
pnpm test
pnpm evals
pnpm docs:index
pnpm docs:check
pnpm docs:impact -- --base origin/main
```

Migrations/RLS, payments/webhooks, AI providers, browser/device acceptance, staging smoke, and
production observation require their domain-specific evidence. Never report an unrun check or mock as
real verification.

## Handoff Contract

Every merge or meaningful project change must leave enough durable state for another Agent to answer:

- What phase and maturity is the project in?
- What is active, merged, blocked, or retired?
- Which evidence has actually passed?
- What should happen next, in what dependency order?
- Which Markdown files must be read before touching the assigned module?
- Which assumptions, risks, or observation windows remain open?

If those answers exist only in chat, the work is not complete.
