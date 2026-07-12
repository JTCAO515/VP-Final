# Phase 0/1 Dependency Graph

> **Status:** Active control baseline  
> **Owner:** Overall design / architecture  
> **Last reviewed:** 2026-07-11  
> **Authority:** This document is the dependency source of truth for Phase 0/1. GitHub Issue prose may link here but must not create a contradictory dependency.

## 1. Operating Rules

- One control action has one open canonical owner. `status:superseded` Issues are historical evidence only and are never implementation entry points.
- A `status:blocked` Issue must name a concrete dependency, accepted policy/ADR, lifecycle trigger, or recorded operator decision.
- `status:ready` only means its listed gates are met; an Agent must still read the mandatory reading order, the relevant ADR/policy, and the Issue before coding.
- Closed completed work is evidence, not an active blocker. Do not reference it as `blocked by`.
- Every code PR updates `docs/handoff.json`, regenerates `docs/INDEX.md`, and records observed deviation/corrective action when actual behavior differs from this graph.
- External accounts, secrets, payment entities, DNS, deployment, or other operator-only actions stay as placeholders until recorded in the operator-action register. No implementation may claim a third-party capability is live before its verification evidence exists.

## 2. Canonical Phase 0 Control Graph

| Control action                        | Canonical Issue                                                                                                                                                                                                                                                   | Subsystem                 | Blocked by                                                                           | Unblocks / constrains                    | State                                              | Milestone |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ | ---------------------------------------- | -------------------------------------------------- | --------- |
| Identity and Trip ownership ADR       | [DOC-P0-01 #131](https://github.com/JTCAO515/VP-Final/issues/131)                                                                                                                                                                                                 | D2 identity/Trip security | Governance baseline complete                                                         | P0-03, P0-04                             | Ready                                              | 0A        |
| Runtime modes and adapter ADR         | [DOC-P0-02 #132](https://github.com/JTCAO515/VP-Final/issues/132)                                                                                                                                                                                                 | D2 runtime truth          | Governance baseline complete                                                         | P0-06, P0-10, P0-20                      | Ready                                              | 0A        |
| Knowledge/SEO evidence policy         | [DOC-P0-03 #133](https://github.com/JTCAO515/VP-Final/issues/133)                                                                                                                                                                                                 | D2 knowledge trust        | Governance baseline complete                                                         | P0-08, P0-16, knowledge/SEO queue        | Ready                                              | 0B        |
| Human Help service policy             | [DOC-P0-04 #134](https://github.com/JTCAO515/VP-Final/issues/134)                                                                                                                                                                                                 | D3 service/policy         | Operator decisions                                                                   | P0-13 through P0-17; P1-04               | Ready                                              | 0C        |
| Operator-action register/tutorials    | [DOC-P0-05 #138](https://github.com/JTCAO515/VP-Final/issues/138)                                                                                                                                                                                                 | D2 operational handoff    | Governance baseline complete                                                         | Any external setup/release claim         | Ready                                              | 0A        |
| Auth SSR and signed anonymous session | [P0-03 #112](https://github.com/JTCAO515/VP-Final/issues/112)                                                                                                                                                                                                     | D2 identity               | DOC-P0-01                                                                            | P0-04, P0-06, P0-09, P0-13, P0-19, P0-20 | Blocked                                            | 0A        |
| Trip ownership/concurrency            | [P0-04 #113](https://github.com/JTCAO515/VP-Final/issues/113), split into [04a #166](https://github.com/JTCAO515/VP-Final/issues/166) → [04b #167](https://github.com/JTCAO515/VP-Final/issues/167) → [04c #168](https://github.com/JTCAO515/VP-Final/issues/168) | D2 Trip persistence       | P0-03 implementation PR #164; production release also requires OA-001 through OA-003 | durable Trip consumers                   | 04a/04b merged; 04c active; parent release blocked | 0A        |
| Ops authentication/RBAC               | [P0-05 #114](https://github.com/JTCAO515/VP-Final/issues/114)                                                                                                                                                                                                     | D2 permissions            | DOC-P0-01; P0-03 implementation merged, OA-001..003 remain release gates             | P0-06, P0-13 through P0-18               | Merged; production release still requires OA-010   | 0A        |
| Durable production adapters           | [P0-06 #115](https://github.com/JTCAO515/VP-Final/issues/115), split into [06a #174](https://github.com/JTCAO515/VP-Final/issues/174) → [06b #173](https://github.com/JTCAO515/VP-Final/issues/173) → [06c #176](https://github.com/JTCAO515/VP-Final/issues/176) → [06d #175](https://github.com/JTCAO515/VP-Final/issues/175) | D2 persistence            | DOC-P0-02; P0-03/P0-05 implementation merged; live OA evidence remains release-only  | P0-07 through P0-20 durable paths        | 06a-06d merged; live OA evidence remains release-only | 0A        |
| Real structured LLM execution         | [P0-07 #116](https://github.com/JTCAO515/VP-Final/issues/116)                                                                                                                                                                                                     | D2 AI runtime             | DOC-P0-02, P0-06, P0-09                                                              | P0-10, P0-20, launch evidence            | Blocked                                            | 0B        |
| Retrieval and citations               | [P0-08 #117](https://github.com/JTCAO515/VP-Final/issues/117)                                                                                                                                                                                                     | D2 knowledge              | DOC-P0-03, P0-06, P0-09                                                              | citations/Explore/knowledge consumers    | Blocked                                            | 0B        |
| Trace/cost evidence                   | [P0-09 #73](https://github.com/JTCAO515/VP-Final/issues/73)                                                                                                                                                                                                       | D2 observability          | P0-03, P0-06                                                                         | P0-07, P0-08, P0-10, P0-19               | PR #182 CI passed; awaiting merge                  | 0B        |
| Durable two-stage generation          | [P0-10 #118](https://github.com/JTCAO515/VP-Final/issues/118)                                                                                                                                                                                                     | D2 Copilot lifecycle      | DOC-P0-02, P0-04, P0-06, P0-07, P0-09                                                | public Copilot generation                | Blocked                                            | 0B        |
| Truthful states/dead-control removal  | [P0-11 #119](https://github.com/JTCAO515/VP-Final/issues/119)                                                                                                                                                                                                     | D2 product truth          | DOC-P0-02, P0-06                                                                     | Web launch safety                        | Blocked                                            | 0B        |
| Copilot information architecture      | [P0-12 #120](https://github.com/JTCAO515/VP-Final/issues/120)                                                                                                                                                                                                     | D1 UX architecture        | P0-10, P0-11                                                                         | P0-18 commercial surface                 | Blocked                                            | 0B        |
| Durable Human Task creation           | [P0-13 #150](https://github.com/JTCAO515/VP-Final/issues/150)                                                                                                                                                                                                     | D3 Human Help data        | DOC-P0-01/02/04, P0-03, P0-05, P0-06                                                 | P0-14 through P0-17, P0-19               | Blocked                                            | 0C        |
| Human Task state machine              | [P0-14 #151](https://github.com/JTCAO515/VP-Final/issues/151)                                                                                                                                                                                                     | D3 task control           | DOC-P0-04, P0-05, P0-06, P0-13                                                       | P0-15 through P0-17, P0-19               | Blocked                                            | 0C        |
| Authorized Ops triage                 | [P0-15 #152](https://github.com/JTCAO515/VP-Final/issues/152)                                                                                                                                                                                                     | D3 operations             | DOC-P0-04, P0-05, P0-13, P0-14                                                       | P0-16, P0-17, P1-04                      | Blocked                                            | 0C        |
| Private task evidence/gap draft       | [P0-16 #153](https://github.com/JTCAO515/VP-Final/issues/153)                                                                                                                                                                                                     | D3 evidence feedback      | DOC-P0-03/04, P0-08, P0-13 through P0-15                                             | P1 knowledge review                      | Blocked                                            | 0C        |
| Verified Stripe task payments         | [P0-17 #154](https://github.com/JTCAO515/VP-Final/issues/154)                                                                                                                                                                                                     | D3 payments               | VP-Codex-Final#169 D3/D4, DOC-P0-04, P0-13 through P0-15, P0-20                      | paid-task evidence, P0-19 payment events | Blocked                                            | 0C        |
| Outbound ledger/partner guard         | [P0-18 #155](https://github.com/JTCAO515/VP-Final/issues/155)                                                                                                                                                                                                     | D3 affiliate trust        | DOC-P0-02, P0-05, P0-06, P0-12                                                       | P0-19, partner launch evidence           | Blocked                                            | 0C        |
| Telemetry/funnel views                | [P0-19 #156](https://github.com/JTCAO515/VP-Final/issues/156)                                                                                                                                                                                                     | D2/D3 observation         | P0-03, P0-06, P0-09, P0-13, P0-14, P0-18; payment event after P0-17                  | Phase 0 evidence, Phase 1 trigger review | Blocked                                            | 0C        |
| Public runtime safety/budgets         | [P0-20 #157](https://github.com/JTCAO515/VP-Final/issues/157)                                                                                                                                                                                                     | D2 safety/cost            | DOC-P0-02, P0-03, P0-06, P0-07, P0-19                                                | P0-17 payment; public launch             | Blocked                                            | 0D        |

### Critical Paths

```text
DOC-P0-01 -> P0-03 -> P0-06 -> P0-09 -> P0-07 -> P0-10 -> P0-12
DOC-P0-04 -> P0-13 -> P0-14 -> P0-15 -> P0-16
DOC-P0-04 + VP-Codex-Final#169 D3/D4 + P0-20 -> P0-17
P0-05 + P0-06 + P0-12 -> P0-18 -> P0-19 -> P0-20
```

## 3. Historical Migration Map

The following remain open only as historical V2 records and carry `status:superseded`. Their original body preserves evidence; implementation starts from the canonical owner.

| Superseded V2 Issue                                   | Canonical owner               |
| ----------------------------------------------------- | ----------------------------- |
| V2-42 #60                                             | P0-13 #150                    |
| V2-43 #61                                             | P0-14 #151                    |
| V2-44 #62                                             | P0-15 #152                    |
| V2-45 #63                                             | P0-16 #153                    |
| V2-46 #64, V2-47 #65                                  | P0-17 #154                    |
| V2-48 #66, V2-49 #67, V2-50 #68                       | P0-18 #155                    |
| V2-52 #87, V2-53 #88, V2-54 #89, V2-55 #70, V2-56 #71 | P0-19 #156                    |
| V2-57 #90, V2-58 #91                                  | P0-20 #157                    |
| V2-60 #73                                             | renamed in place as P0-09 #73 |

## 4. Retained Standalone Queue and Required Decision

These Issues are not duplicated by a P0 owner today. They remain their own active owner until a future G3 review explicitly maps, retires, or renumbers them. No Agent may silently create a competing P0 replacement.

| Area                              | Current owner                              | Gate                                                                          |
| --------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| Explore facts                     | V2-36 #57                                  | DOC-P0-03 and P0-08 evidence/retrieval policy                                 |
| Explore commercial link           | V2-37 #58                                  | P0-18 partner/outbound guard and commerce-intent policy                       |
| SEO matrix/data/override/indexing | V2-38 #59, V2-39 #84, V2-40 #85, V2-41 #86 | DOC-P0-03; quality review, no raw page-count target                           |
| Provider self-check/evals         | V2-59 #72, V2-61 #74                       | P0-07/P0-09/P0-20; real-provider evidence only                                |
| Legal/runbook/smoke               | V2-62 #75, V2-63 #92, V2-64 #93            | DOC-P0-04, DOC-P0-05, P0-17/P0-20 as applicable                               |
| Phase 1 and 2 V2 queues           | #76-83, #94-101                            | Phase trigger evidence or explicit operator override recorded in an ADR/Issue |

## 5. Phase 1 and Phase 2 Gates

- **Phase 1:** Do not begin functional work merely because a ticket exists. Require the stated Phase 0 evidence threshold, or a documented operator override with owner, date, commercial reason, and rollback criterion.
- **P1-04 Rescue Mode #124:** blocked by accepted DOC-P0-04 #134 and P0-15 #152, P0-16 #153, P0-20 #157. It is not a substitute for official emergency services.
- **Phase 2/mobile:** require the Phase 1 trigger decision. Store/IAP, supplier, and payment work additionally requires the manual-action register and the relevant legal/entity decision.

## 6. Dependency Validation Procedure

Before merging a backlog-changing PR:

1. Search every open Issue body for `blocked by`, `unblocks`, and `P0-/P1-/P2-` references.
2. Confirm every named Issue exists and has exactly one canonical open owner; do not treat `status:superseded` records as executable dependencies.
3. Confirm any accepted ADR/policy is explicitly named rather than inferred from a closed implementation PR.
4. Reconcile this table, the master backlog #102, `docs/handoff.json`, and generated `docs/INDEX.md`.
5. Record the scan command/result in the PR. GitHub metadata is not available to offline documentation CI, so this manual API scan is required until a token-safe backlog linter is introduced.

## 7. Observations and Corrective Action

- **Observed deviation:** two independently numbered task systems caused overlapping execution paths and dangling identifiers.
- **Correction:** P0/P1/P2 is canonical; superseded V2 records retain history and point one way to their owner.
- **Next observation:** after the first DOC-P0 acceptance and implementation PR, audit whether Issue prose, the graph, and actual module ownership still agree. Any mismatch is D2 and requires graph/Issue/hand-off correction before adjacent work expands.
