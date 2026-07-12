# Phase Dependency Graph

> **Status:** Active control baseline
> **Owner:** Overall design / architecture
> **Last reviewed:** 2026-07-13
> **Authority:** The sole dependency, owner, and lane source for Phase 0 through Phase 3 controls.

## Operating Rules

- One control action has one canonical open Issue and one owner. `status:superseded` Issues are
  historical evidence, never implementation entry points.
- A control is executable only when this graph, its Issue, accepted policy/ADR, and lifecycle gate
  agree. A green PR still needs architecture review under [#181](https://github.com/JTCAO515/VP-Final/issues/181).
- An owner owns the listed physical lane. Another Agent may consume an accepted interface but must
  not concurrently mutate the lane.
- `Blocked` means a concrete dependency, operator action, or measurable trigger is missing. Do not
  replace it with a mock, fixture, or unilateral policy decision.
- External accounts, keys, payment entities, legal policy, DNS, and deployment evidence remain
  placeholders in the [operator action register](operator-action-register.md) until verified.

## Lane Contract

| Owner        | Physical lane                                                        | Responsibility                                                                         |
| ------------ | -------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Codex        | `apps/server`, `packages/domain`, `packages/ai`, Web/Ops integration | Canonical P0 execution, AI, knowledge, task, commerce, telemetry, and app consumption. |
| Codex        | `docs/design-system/*`, `packages/ui`                                | Canonical semantic tokens and visual verification; no feature-workflow redesign.       |
| Architecture | `docs/governance/*`, GitHub control metadata                         | ADR/policy, graph integrity, backlog decisions, and review/merge gate.                 |
| Operator     | Third-party consoles and commercial/legal decisions                  | Evidence and decisions recorded in the action register.                                |

**Handoff:** P1-09 [#127](https://github.com/JTCAO515/VP-Final/issues/127) produces
`@visepanda/ui` semantic tokens. P0-12 [#120](https://github.com/JTCAO515/VP-Final/issues/120)
and later product surfaces consume them without redefining brand colors, spacing, or radius.

## Governance Controls

| Control                                | Issue                                                   | Owner / lane                   | Gate                                                       | State                                                   |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------ | ---------------------------------------------------------- | ------------------------------------------------------- |
| Master roadmap and canonical ownership | [#102](https://github.com/JTCAO515/VP-Final/issues/102) | Architecture / GitHub metadata | This graph and handoff must agree                          | Active; navigation layer, not an implementation lane    |
| Phase graph and lane delta             | [#139](https://github.com/JTCAO515/VP-Final/issues/139) | Codex / governance docs        | Docs check, graph scan, architecture review                | Active; this document expands the graph through Phase 3 |
| Architecture review and merge gate     | [#181](https://github.com/JTCAO515/VP-Final/issues/181) | Architecture / PR workflow     | Full CI green, then ready/request-review; never self-merge | Active, mandatory for every implementation PR           |

## Phase 0

| Control                      | Issue                                                                                                                                                                                                                                                  | Owner / lane                     | Gate                                                          | Current state / handoff                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Identity/Trip ADR            | [DOC-P0-01 #131](https://github.com/JTCAO515/VP-Final/issues/131)                                                                                                                                                                                      | Architecture / governance        | None                                                          | Accepted, merged; enables P0-03/04                                                                         |
| Runtime truth ADR            | [DOC-P0-02 #132](https://github.com/JTCAO515/VP-Final/issues/132)                                                                                                                                                                                      | Architecture / governance        | None                                                          | Accepted, merged; enables P0-06/10/20                                                                      |
| Knowledge evidence ADR       | [DOC-P0-03 #133](https://github.com/JTCAO515/VP-Final/issues/133)                                                                                                                                                                                      | Architecture / governance        | None                                                          | Accepted, merged; enables P0-08/16                                                                         |
| Human Help policy            | [DOC-P0-04 #134](https://github.com/JTCAO515/VP-Final/issues/134)                                                                                                                                                                                      | Operator + Architecture / policy | OA-007 scope, city, hours, SLA, price/refund, PII, escalation | Blocked; no service promise                                                                                |
| Operator actions             | [DOC-P0-05 #138](https://github.com/JTCAO515/VP-Final/issues/138)                                                                                                                                                                                      | Architecture / governance        | None                                                          | Accepted, merged                                                                                           |
| Auth/anonymous identity      | [P0-03 #112](https://github.com/JTCAO515/VP-Final/issues/112)                                                                                                                                                                                          | Codex / server + Web             | OA-001..003 release evidence                                  | Code merged; release evidence blocked                                                                      |
| Trip ownership               | [P0-04 #113](https://github.com/JTCAO515/VP-Final/issues/113)                                                                                                                                                                                          | Codex / domain + server + Web    | OA-001..003 release evidence                                  | Code merged; release evidence blocked                                                                      |
| Ops RBAC                     | [P0-05 #114](https://github.com/JTCAO515/VP-Final/issues/114)                                                                                                                                                                                          | Codex / server + Ops             | OA-010 deployed-role evidence                                 | Code merged; release evidence blocked                                                                      |
| Durable adapters             | [P0-06 #115](https://github.com/JTCAO515/VP-Final/issues/115)                                                                                                                                                                                          | Codex / server runtime           | OA-004 is release-only                                        | Code merged                                                                                                |
| Structured LLM               | [P0-07 #116](https://github.com/JTCAO515/VP-Final/issues/116), [01a2 #196](https://github.com/JTCAO515/VP-Final/issues/196), [01a3 #197](https://github.com/JTCAO515/VP-Final/issues/197), [07b #188](https://github.com/JTCAO515/VP-Final/issues/188) | Codex / AI + server              | OA-005 provider configuration/catalog evidence                | PR #195 provider inventory and PRs #198/#199 route/pipeline are review-pending; live proof remains blocked |
| Retrieval/citations          | [P0-08 #117](https://github.com/JTCAO515/VP-Final/issues/117), [08b #192](https://github.com/JTCAO515/VP-Final/issues/192)                                                                                                                             | Codex / domain + knowledge       | P0-08a merged; architecture review                            | PR #200 review-pending                                                                                     |
| Trace/cost evidence          | [P0-09 #73](https://github.com/JTCAO515/VP-Final/issues/73)                                                                                                                                                                                            | Codex / server + DB              | None                                                          | Merged / closed                                                                                            |
| Durable two-stage generation | [P0-10 #118](https://github.com/JTCAO515/VP-Final/issues/118)                                                                                                                                                                                          | Codex / server + Web             | P0-07 accepted/live path                                      | Blocked                                                                                                    |
| Truthful product states      | [P0-11 #119](https://github.com/JTCAO515/VP-Final/issues/119)                                                                                                                                                                                          | Codex / Web                      | P0-07/P0-10 accepted interfaces                               | Blocked; DEMO subset is #184                                                                               |
| Copilot IA                   | [P0-12 #120](https://github.com/JTCAO515/VP-Final/issues/120)                                                                                                                                                                                          | Codex / Web                      | P0-10, P0-11; consumes P1-09 tokens                           | Blocked                                                                                                    |
| Human Task persistence       | [P0-13 #150](https://github.com/JTCAO515/VP-Final/issues/150)                                                                                                                                                                                          | Codex / server + Web             | DOC-P0-04, P0-03/05/06                                        | Blocked; hands to P0-14/19                                                                                 |
| Task state machine           | [P0-14 #151](https://github.com/JTCAO515/VP-Final/issues/151)                                                                                                                                                                                          | Codex / domain + server          | DOC-P0-04, P0-13                                              | Blocked; hands to P0-15..17                                                                                |
| Authorized triage            | [P0-15 #152](https://github.com/JTCAO515/VP-Final/issues/152)                                                                                                                                                                                          | Codex / Ops + server             | DOC-P0-04, P0-13/14                                           | Blocked; hands to P0-16/17/P1-04                                                                           |
| Private task evidence        | [P0-16 #153](https://github.com/JTCAO515/VP-Final/issues/153)                                                                                                                                                                                          | Codex / server + Ops             | DOC-P0-04, P0-08, P0-13..15                                   | Blocked                                                                                                    |
| Stripe task payment          | [P0-17 #154](https://github.com/JTCAO515/VP-Final/issues/154)                                                                                                                                                                                          | Operator + Codex / commerce      | VP-Codex-Final#169 D3/D4, DOC-P0-04, P0-13..15, P0-20         | Blocked; no Stripe code before entity decision                                                             |
| Outbound ledger              | [P0-18 #155](https://github.com/JTCAO515/VP-Final/issues/155)                                                                                                                                                                                          | Codex / commerce + Web           | P0-12, P0-05/06                                               | Blocked; hands to P0-19                                                                                    |
| Funnel telemetry             | [P0-19 #156](https://github.com/JTCAO515/VP-Final/issues/156)                                                                                                                                                                                          | Codex / telemetry + DB           | P0-13/14/18                                                   | Blocked                                                                                                    |
| Public safety/budgets        | [P0-20 #157](https://github.com/JTCAO515/VP-Final/issues/157)                                                                                                                                                                                          | Codex / server + Web             | P0-07 live path, P0-19                                        | Blocked                                                                                                    |

### DEMO-01

| Control                    | Issue                                                   | Owner / lane                   | Gate                                             | State                               |
| -------------------------- | ------------------------------------------------------- | ------------------------------ | ------------------------------------------------ | ----------------------------------- |
| Real LLM Copilot milestone | [#183](https://github.com/JTCAO515/VP-Final/issues/183) | Codex / AI + server + Web      | #116, #184, #185                                 | Open; child controls below          |
| Dialogue surface           | [#184](https://github.com/JTCAO515/VP-Final/issues/184) | Codex / Web                    | #116 contract + review                           | PR #201 review-pending              |
| Cost guard                 | [#185](https://github.com/JTCAO515/VP-Final/issues/185) | Architecture + Codex / runtime | Trusted IP, durable limiter, telemetry injection | D2 blocked; no in-memory workaround |

## Phase 1

| Control                        | Issue                                                         | Owner / lane                          | Gate                                    | State                                          |
| ------------------------------ | ------------------------------------------------------------- | ------------------------------------- | --------------------------------------- | ---------------------------------------------- |
| Fact provenance/review         | [P1-01 #121](https://github.com/JTCAO515/VP-Final/issues/121) | Codex / knowledge + Ops               | P0-08 and Phase 0 production evidence   | Blocked                                        |
| Readiness Check                | [P1-02 #122](https://github.com/JTCAO515/VP-Final/issues/122) | Codex / domain + Web + telemetry      | P0-12, P0-18, P0-19                     | Blocked                                        |
| Offline Arrival Pack           | [P1-03 #123](https://github.com/JTCAO515/VP-Final/issues/123) | Codex / domain + Web                  | P1-02, reviewed content, P0-04          | Blocked                                        |
| Rescue Mode                    | [P1-04 #124](https://github.com/JTCAO515/VP-Final/issues/124) | Operator + Codex / Web + task         | DOC-P0-04 accepted, P0-15, P0-16, P0-20 | Blocked                                        |
| Unit economics                 | [P1-08 #126](https://github.com/JTCAO515/VP-Final/issues/126) | Operator + Codex / commerce reporting | P0-17 plus 20 real closed tasks         | Blocked                                        |
| Design tokens                  | [P1-09 #127](https://github.com/JTCAO515/VP-Final/issues/127) | Codex / design docs + `packages/ui`   | Architecture review                     | PR #202 review-pending; P0-12 consumer handoff |
| Production model configuration | [#194](https://github.com/JTCAO515/VP-Final/issues/194)       | Operator + Codex / AI runtime         | Formal launch and observed traffic/cost | Trigger-gated; do not implement                |

## Phase 2 — Trigger-Gated, Do Not Implement

| Control                          | Issue                                                         | Owner / lane                               | Mandatory trigger and dependencies                                    |
| -------------------------------- | ------------------------------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------- |
| Execution Pass entitlement       | [P2-06 #128](https://github.com/JTCAO515/VP-Final/issues/128) | Operator + Codex / commerce + mobile       | Phase 1 trigger, App readiness, legal review, paid-task/cost evidence |
| Consent-based custom quote pilot | [P2-07 #129](https://github.com/JTCAO515/VP-Final/issues/129) | Operator + Codex / quote + Ops             | One city has five qualified requests/month and legal approval         |
| Trip Pass pricing experiment     | [P2-08 #141](https://github.com/JTCAO515/VP-Final/issues/141) | Operator + Codex / entitlement + telemetry | P2-06; quote/repeat threshold and Human Task willingness-to-pay       |
| Lead-fee quote product           | [P2-09 #142](https://github.com/JTCAO515/VP-Final/issues/142) | Operator + Codex / quote + ledger          | P2-07 and repeat/business visitor evidence                            |
| Provider network                 | [P2-10 #143](https://github.com/JTCAO515/VP-Final/issues/143) | Operator + Codex / Ops + task              | P0-15/16, DOC-P0-04, P0-05; first 50 concierge tasks documented       |
| Commission reconciliation        | [P2-11 #144](https://github.com/JTCAO515/VP-Final/issues/144) | Codex / commerce + Ops                     | P0-18 and actual affiliate commission flows; absorbs V2-51 #69        |

## Phase 3 — Trigger-Gated, Do Not Implement

| Control                           | Issue                                                             | Owner / lane                           | Mandatory trigger and dependencies                                         |
| --------------------------------- | ----------------------------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------- |
| Settlement/take-rate ADR          | [DOC-P3-01 #145](https://github.com/JTCAO515/VP-Final/issues/145) | Operator + Architecture / legal policy | VP-Codex-Final#169 D4; Phase 3 preparation near 100 monthly matched orders |
| Take-rate ledger                  | [P3-01 #146](https://github.com/JTCAO515/VP-Final/issues/146)     | Operator + Codex / commerce ledger     | DOC-P3-01 accepted; matched orders >=100; legal entity ready               |
| Cross-border payout               | [P3-02 #147](https://github.com/JTCAO515/VP-Final/issues/147)     | Operator + Codex / settlement          | DOC-P3-01, P3-01, D4 entity, compliant payout channel                      |
| Whitelisted merchant self-service | [P3-03 #148](https://github.com/JTCAO515/VP-Final/issues/148)     | Codex / Ops + permissions              | P0-05, P2-10, monthly orders >=100                                         |

## Historical and Standalone Work

P0-13 through P0-20 are the canonical successors to V2-42 through V2-58; V2-60 was renamed as
P0-09. V2-51 #69 is absorbed by P2-11 #144. Retained Explore, SEO, provider-self-check,
legal/runbook, and smoke owners listed in [#102](https://github.com/JTCAO515/VP-Final/issues/102)
remain standalone until a G3 decision maps them; no Agent may create a competing P0 owner.

## Validation and Correction

Before a backlog or lane change merges, scan open non-PR Issues for `blocked by`, `unblocks`, and
`P0-`/`P1-`/`P2-`/`P3-` references; reconcile this graph, [#102](https://github.com/JTCAO515/VP-Final/issues/102), handoff, and Index.

**D2 correction:** the former Phase 0/1 graph omitted Phase 2/3 controls and lane ownership, and
its P0 state column lagged accepted merges and review-pending PRs. This graph corrects control state
without changing product scope or triggers.
