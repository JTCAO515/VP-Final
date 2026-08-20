# Phase 0/1 Dependency Graph

> **Status:** Active control baseline  
> **Owner:** Overall design / architecture  
> **Last reviewed:** 2026-08-20
> **Authority:** This document is the dependency source of truth for Phase 0/1. [ADR-0023](../adr/ADR-0023-chatbot-execution-core.md) is the current product-order amendment; GitHub Issue prose may link here but must not create a contradictory dependency.

## 1. Operating Rules

- One control action has one open canonical owner. `status:superseded` Issues are historical evidence only and are never implementation entry points.
- A `status:blocked` Issue must name a concrete dependency, accepted policy/ADR, lifecycle trigger, or recorded operator decision.
- `status:ready` only means its listed gates are met; an Agent must still read the mandatory reading order, the relevant ADR/policy, and the Issue before coding.
- Closed completed work is evidence, not an active blocker. Do not reference it as `blocked by`.
- Ordinary implementation and governance PRs must not edit `docs/handoff.json` or the generated `docs/INDEX.md`. They record the expected handoff delta in the PR; a dedicated serialized snapshot PR refreshes both files after the merge queue settles.
- External accounts, secrets, payment entities, DNS, deployment, or other operator-only actions stay as placeholders until recorded in the operator-action register. No implementation may claim a third-party capability is live before its verification evidence exists.

## 2. Current Canonical Focus Queue (ADR-0023)

The completed Phase 0 controls in the next section remain prerequisite evidence, not competing product
work. The only current implementation order is the Chatbot execution-core queue below.

| Control action | Canonical Issue | Subsystem | Blocked by | Unblocks / constrains | State | Milestone |
| --- | --- | --- | --- | --- | --- | --- |
| Chatbot execution-core baseline | [FOCUS-00 #521](https://github.com/JTCAO515/VP-Final/issues/521) | D3 product authority | Operator-approved decision | FOCUS-01; FACT-SCOPE-01 | Complete; ADR-0023 and PR #522 merged | 0 |
| Backlog reclassification | [FOCUS-01 #525](https://github.com/JTCAO515/VP-Final/issues/525) | D3 governance | FOCUS-00 | FACT-SCOPE-01 | Active | 0 |
| Scoped Execution Fact contract | FACT-SCOPE-01 (created after FOCUS-01) | D2 domain/knowledge | FOCUS-01 | scoped persistence, Chatbot actions, Payment | Not opened | 1 |
| Scoped fact persistence/retrieval | FACT-SCOPE-02 (created after FACT-SCOPE-01) | D2 data/knowledge | FACT-SCOPE-01 | Chatbot scoped retrieval | Not opened | 1 |
| Minimal Execution Action contract | CHAT-ACTION-01 (created after FACT-SCOPE-01) | D2 domain/Copilot | FACT-SCOPE-01 | Chatbot execution rendering and routing | Not opened | 1 |
| Chatbot scoped retrieval/action routing | CHAT-RUNTIME-01 | D2 server/AI | FACT-SCOPE-02; CHAT-ACTION-01 | Chatbot execution workspace | Not opened | 1 |
| Chatbot Execution Action rendering | CHAT-WEB-01 | D1 Web | CHAT-RUNTIME-01 | Payment vertical slice | Not opened | 1 |
| Payment fact content and deterministic action | PAY-EXEC-01 -> PAY-EXEC-03 | D3 knowledge/product | Chatbot action path; operator-reviewed facts | Show to Local / Entry comparison | Not opened; external content remains operator-owned | 2 |
| Show to Local vertical slice | LOCAL-EXEC-01 -> reframed [#347](https://github.com/JTCAO515/VP-Final/issues/347) | D2 knowledge/Chatbot | Payment slice evidence; resolved POI facts | Entry slice | Deferred, not frozen | 3 |
| Entry / Booking vertical slice | ENTRY-EXEC-01 -> ENTRY-EXEC-02 | D3 knowledge/Chatbot | Show to Local operating evidence | execution-model review | Not opened | 3 |
| Narrowed Content AI v0 | [#499](https://github.com/JTCAO515/VP-Final/issues/499) -> #503 | D3 Ops/knowledge | scoped facts plus Payment/Show to Local/Entry operating evidence | controlled content production | Paused | 4 |
| Focused production runbook/smoke | reframed [#92](https://github.com/JTCAO515/VP-Final/issues/92) and [#93](https://github.com/JTCAO515/VP-Final/issues/93) | D3 release evidence | three vertical slices | controlled public MVP decision | Deferred | 5 |

### Explicitly deferred or frozen queues

- Content AI #504 through #510: media, provider candidates, GitHub draft export, broad E2E, and map
  data-rights research are deferred. They do not block the scoped-fact or first three execution slices.
- VisePod #278 through #304 is frozen under ADR-0023. Its evidence records remain historical and no
  new device runtime work is current product work.
- Stripe #154, model-rights #194, Phase 2/3 commerce, and trigger-gated mobile work remain deferred
  behind their independent legal, commercial, external-evidence, or adoption gates.
- Operator-owned #343 is reframed as real six-moment traveller research. It is not a coding task and
  cannot be replaced with AI-generated samples.

## 3. Historical Phase 0 Foundation

| Control action                        | Canonical Issue                                                                                                                                                                                                                                                                                                                 | Subsystem                 | Blocked by                                                                           | Unblocks / constrains                                                       | State                                                                                     | Milestone |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | --------- |
| Identity and Trip ownership ADR       | [DOC-P0-01 #131](https://github.com/JTCAO515/VP-Final/issues/131)                                                                                                                                                                                                                                                               | D2 identity/Trip security | Governance baseline complete                                                         | P0-03, P0-04                                                                | Complete; Issue closed                                                                    | 0A        |
| Runtime modes and adapter ADR         | [DOC-P0-02 #132](https://github.com/JTCAO515/VP-Final/issues/132)                                                                                                                                                                                                                                                               | D2 runtime truth          | Governance baseline complete                                                         | P0-06, P0-10, P0-20                                                         | Complete; Issue closed                                                                    | 0A        |
| Knowledge/SEO evidence policy         | [DOC-P0-03 #133](https://github.com/JTCAO515/VP-Final/issues/133)                                                                                                                                                                                                                                                               | D2 knowledge trust        | Governance baseline complete                                                         | P0-08, P0-16, knowledge/SEO queue                                           | Complete; Issue closed                                                                    | 0B        |
| Human Help service policy             | [DOC-P0-04 #134](https://github.com/JTCAO515/VP-Final/issues/134)                                                                                                                                                                                                                                                               | D3 service/policy         | Controlled-preview policy repository review                                          | P0-13 through P0-16; P0-17 additionally needs D3/D4 payment decision; P1-04 | Accepted and merged in PR #214                                                            | 0C        |
| Operator-action register/tutorials    | [DOC-P0-05 #138](https://github.com/JTCAO515/VP-Final/issues/138)                                                                                                                                                                                                                                                               | D2 operational handoff    | Governance baseline complete                                                         | Any external setup/release claim                                            | Complete; Issue closed                                                                    | 0A        |
| Auth SSR and signed anonymous session | [P0-03 #112](https://github.com/JTCAO515/VP-Final/issues/112)                                                                                                                                                                                                                                                                   | D2 identity               | DOC-P0-01                                                                            | P0-04, P0-06, P0-09, P0-13, P0-19, P0-20                                    | Complete; Issue closed                                                                    | 0A        |
| Trip ownership/concurrency            | [P0-04 #113](https://github.com/JTCAO515/VP-Final/issues/113), split into [04a #166](https://github.com/JTCAO515/VP-Final/issues/166) → [04b #167](https://github.com/JTCAO515/VP-Final/issues/167) → [04c #168](https://github.com/JTCAO515/VP-Final/issues/168)                                                               | D2 Trip persistence       | P0-03 implementation baseline                                                        | durable Trip consumers                                                      | Complete; Issue closed                                                                    | 0A        |
| Ops authentication/RBAC               | [P0-05 #114](https://github.com/JTCAO515/VP-Final/issues/114)                                                                                                                                                                                                                                                                   | D2 permissions            | DOC-P0-01                                                                            | P0-06, P0-13 through P0-18                                                  | Complete; Issue closed                                                                    | 0A        |
| Durable production adapters           | [P0-06 #115](https://github.com/JTCAO515/VP-Final/issues/115), split into [06a #174](https://github.com/JTCAO515/VP-Final/issues/174) → [06b #173](https://github.com/JTCAO515/VP-Final/issues/173) → [06c #176](https://github.com/JTCAO515/VP-Final/issues/176) → [06d #175](https://github.com/JTCAO515/VP-Final/issues/175) | D2 persistence            | DOC-P0-02; P0-03/P0-05 implementation baseline                                       | P0-07 through P0-20 durable paths                                           | Complete; Issue closed                                                                    | 0A        |
| Real structured LLM execution         | [P0-07 #116](https://github.com/JTCAO515/VP-Final/issues/116), split into [07a #187](https://github.com/JTCAO515/VP-Final/issues/187) → [07b #188](https://github.com/JTCAO515/VP-Final/issues/188)                                                                                                                             | D2 AI runtime             | DOC-P0-02, P0-06, P0-09; external evidence requires recorded OA-005                  | P0-10, P0-20, launch evidence                                               | Runtime/provider path merged; production trace-row evidence remains a release observation | 0B        |
| Retrieval and citations               | [P0-08 #117](https://github.com/JTCAO515/VP-Final/issues/117), split into [08a #191](https://github.com/JTCAO515/VP-Final/issues/191) → [08b #192](https://github.com/JTCAO515/VP-Final/issues/192)                                                                                                                             | D2 knowledge              | DOC-P0-03, P0-06, P0-09; 08b also requires 08a                                       | citations/Explore/knowledge consumers                                       | Retrieval/citation path merged in PR #200; durable lifecycle/RLS repair merged in PR #225 | 0B        |
| Trace/cost evidence                   | [P0-09 #73](https://github.com/JTCAO515/VP-Final/issues/73)                                                                                                                                                                                                                                                                     | D2 observability          | P0-03, P0-06                                                                         | P0-07, P0-08, P0-10, P0-19                                                  | Merged PR #182; Issue closed                                                              | 0B        |
| Database contract gate integrity      | [P0-21 #211](https://github.com/JTCAO515/VP-Final/issues/211)                                                                                                                                                                                                                                                                   | D2 quality/security       | None                                                                                 | Any claim that Database contracts executed pgTAP/RLS checks                 | Merged PR #212; CI independently passed                                                   | 0A        |
| Durable two-stage generation          | [P0-10 #118](https://github.com/JTCAO515/VP-Final/issues/118), sequenced as contract PR #223 → provenance [#228](https://github.com/JTCAO515/VP-Final/issues/228) → queue/callback [#226](https://github.com/JTCAO515/VP-Final/issues/226) → Web resume [#227](https://github.com/JTCAO515/VP-Final/issues/227)                 | D2 Copilot lifecycle      | DOC-P0-02, DOC-P0-04, P0-06, P0-07, P0-09                                            | public Copilot generation                                                   | Complete; PRs #223/#229/#240/#251 merged and parent #118 closed                           | 0B        |
| Truthful states/dead-control removal  | [P0-11 #119](https://github.com/JTCAO515/VP-Final/issues/119)                                                                                                                                                                                                                                                                   | D2 product truth          | DOC-P0-02, P0-06; P0-10 completion consumed for final-state audit                    | Web launch safety                                                           | Merged PR #253; Issue closed                                                              | 0B        |
| Copilot information architecture      | [P0-12 #120](https://github.com/JTCAO515/VP-Final/issues/120)                                                                                                                                                                                                                                                                   | D1 UX architecture        | P0-10, P0-11, and accepted/implemented legal routes under #75                        | P0-18 commercial surface                                                    | Complete; PR #296 merged and Issue closed                                                 | 0B        |
| Durable Human Task creation           | [P0-13 #150](https://github.com/JTCAO515/VP-Final/issues/150)                                                                                                                                                                                                                                                                   | D3 Human Help data        | DOC-P0-01/02/04, P0-03, P0-05, P0-06                                                 | P0-14 through P0-17, P0-19                                                  | Complete; PR #232 merged and Issue closed                                                 | 0C        |
| Human Task state machine              | [P0-14 #151](https://github.com/JTCAO515/VP-Final/issues/151)                                                                                                                                                                                                                                                                   | D3 task control           | DOC-P0-04, P0-05, P0-06, P0-13                                                       | P0-15 through P0-17, P0-19                                                  | Complete; PR #241 merged and Issue closed                                                 | 0C        |
| Authorized Ops triage                 | [P0-15 #152](https://github.com/JTCAO515/VP-Final/issues/152)                                                                                                                                                                                                                                                                   | D3 operations             | DOC-P0-04, P0-05, P0-13, P0-14                                                       | P0-16, P0-17, P1-04                                                         | Complete; PR #255 merged and Issue closed                                                 | 0C        |
| Private task evidence/gap draft       | [P0-16 #153](https://github.com/JTCAO515/VP-Final/issues/153)                                                                                                                                                                                                                                                                   | D3 evidence feedback      | DOC-P0-03/04, P0-08, P0-13 through P0-15                                             | P1 knowledge review                                                         | Complete; PR #257 merged and Issue closed                                                 | 0C        |
| Verified Stripe task payments         | [P0-17 #154](https://github.com/JTCAO515/VP-Final/issues/154)                                                                                                                                                                                                                                                                   | D3 payments               | VP-Codex-Final#169 D3/D4, DOC-P0-04, P0-13 through P0-15, P0-20                      | paid-task evidence, P0-19 payment events                                    | Blocked                                                                                   | 0C        |
| Outbound ledger/partner guard         | [P0-18 #155](https://github.com/JTCAO515/VP-Final/issues/155)                                                                                                                                                                                                                                                                   | D3 affiliate trust        | DOC-P0-02, P0-05, P0-06, P0-12                                                       | P0-19, partner launch evidence                                              | Complete; PRs #309/#315/#317 merged and Issue closed; no partner is active                | 0C        |
| Telemetry/funnel views                | [P0-19 #156](https://github.com/JTCAO515/VP-Final/issues/156), split into [19a #321](https://github.com/JTCAO515/VP-Final/issues/321) → [19b #322](https://github.com/JTCAO515/VP-Final/issues/322) → [19d #325](https://github.com/JTCAO515/VP-Final/issues/325)                                                               | D2/D3 observation         | 19a merged in PR #323; ADR-0013 constrains producers to durable task_submitted; payment event production remains after P0-17 | Phase 0 evidence, Phase 1 trigger review                                    | Complete; contract/adapter/views, authorized producer subset, and endpoint limit merged | 0C        |
| Public runtime safety/budgets         | [P0-20 #157](https://github.com/JTCAO515/VP-Final/issues/157)                                                                                                                                                                                                                                                                   | D2 safety/cost            | P0-19b/19d and accepted ADR-0015; output #372, input #373, account limit #374, Human Help cap #375, safe recovery #376 | P0-17 payment; public launch                                                | Complete; Issue closed after real GitHub verify/evals/Database contracts/docs gates | 0D        |

### Critical Paths

```text
DOC-P0-01 -> P0-03 -> P0-06 -> P0-09 -> P0-07 -> P0-10 -> P0-11
#75 legal baseline/routes -> P0-12
DOC-P0-04 (accepted policy) -> P0-13 -> P0-14 -> P0-15 -> P0-16
DOC-P0-04 + VP-Codex-Final#169 D3/D4 + P0-20 -> P0-17
P0-05 + P0-06 + P0-12 -> P0-18 -> P0-19 -> P0-20
P0-21 -> every future Database contracts pass claim
```

## 4. Historical Migration Map

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

## 5. Historical Retained Standalone Queue Before Focus

This table records the pre-ADR-0023 standalone queue. Section 2 supersedes it as the active product
order; its rows remain evidence and external gates, not implementation entry points.

| Area                              | Current owner                              | Gate                                                                          |
| --------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------- |
| Explore facts                     | V2-36 #57                                  | PR #236 merged; DOC-P0-03/P0-08 eligibility and durable lifecycle are merged  |
| Explore commercial link           | V2-37 #58                                  | P0-18 terminal boundary plus active-partner/operator evidence; no partner is active |
| SEO matrix/data/override/indexing | V2-38 #59, V2-39 #84, V2-40 #85, V2-41 #86 | DOC-P0-03; quality review, no raw page-count target                           |
| Provider self-check/evals         | V2-59 #72, V2-61 #74                       | P0-07/P0-09/P0-20; real-provider evidence only                                |
| Legal/runbook/smoke               | V2-62 #75, V2-63 #92, V2-64 #93            | #75 remains complete; #92/#93 are reframed in Section 2 behind three execution slices, not P0-17/P0-20 alone |
| Phase 1 and 2 V2 queues           | #76-83, #94-101                            | Phase trigger evidence or explicit operator override recorded in an ADR/Issue |

## 6. Phase 1 and Phase 2 Gates

- **Phase 1:** Do not begin functional work merely because a ticket exists. Require the stated Phase 0 evidence threshold, or a documented operator override with owner, date, commercial reason, and rollback criterion.
- **P1-04 Rescue Mode #124:** blocked by accepted DOC-P0-04 #134 and P0-15 #152, P0-16 #153, P0-20 #157. It is not a substitute for official emergency services.
- **Phase 2/mobile:** require the Phase 1 trigger decision. Store/IAP, supplier, and payment work additionally requires the manual-action register and the relevant legal/entity decision.

## 7. Dependency Validation Procedure

Before merging a backlog-changing PR:

1. Search every open Issue body for `blocked by`, `unblocks`, and `P0-/P1-/P2-` references.
2. Confirm every named Issue exists and has exactly one canonical open owner; do not treat `status:superseded` records as executable dependencies.
3. Confirm any accepted ADR/policy is explicitly named rather than inferred from a closed implementation PR.
4. Reconcile this table, the master backlog #102, `docs/handoff.json`, and generated `docs/INDEX.md`.
5. Record the scan command/result in the PR. GitHub metadata is not available to offline documentation CI, so this manual API scan is required until a token-safe backlog linter is introduced.

## 8. Observations and Corrective Action

- **Observed deviation:** two independently numbered task systems caused overlapping execution paths and dangling identifiers.
- **Correction:** P0/P1/P2 is canonical; superseded V2 records retain history and point one way to their owner.
- **Observed deviation (2026-07-16):** closed, unmerged PR #203 left master Issue #102 pointing to a nonexistent replacement graph while this file retained stale merge-queue and P0-08/P0-10 states.
- **Correction:** preserve this file as the sole Phase 0/1 authority, apply only the verified status delta, and keep handoff/Index serialization outside ordinary PRs per #215.
- **Observed correction (2026-07-20):** PR #253 completed P0-11 with truthful empty/request/failure states and responsive browser evidence. The first metadata pass marked P0-12 ready, but the subsequent route audit below found its #75 premise false and restored the block.
- **Observed correction (2026-07-20):** PR #255 completed P0-15 with permission-bounded detail, note persistence, PII-free audit, and controlled-preview triage. PR #257 subsequently completed P0-16 with private terminal-task evidence, redaction, inherited retention, and sanitized open-gap proposals; an earlier serialized snapshot missed this merged state.
- **Observed correction (2026-07-20):** PR #258 completed #246 with a server-authoritative anonymous three-turn wall, and PR #260 completed #247 with a Vercel-trusted, HMAC-only atomic IP sliding-window guard. Real local Redis protocol evidence passed for both controls; production Upstash/Vercel evidence remains gated by OA-012 and OA-013.
- **Observed correction (2026-07-21):** GitHub closed-state verification found DOC-P0-01 #131, DOC-P0-02 #132, DOC-P0-03 #133, and DOC-P0-05 #138 still described as `Ready`, while completed P0-04c #168 remained described as active. Their rows now record completion; P0-04's separate production OA evidence gate remains unchanged.
- **Observed correction (2026-07-25):** PR #274 merged the operator-accepted Privacy, Terms,
  affiliate-disclosure, Human Help disclaimer, and emergency-disclaimer routes. P0-12 may now
  consume those routes through the shared shell without owning or rewriting their legal content.
- **Observed correction (2026-07-24):** #248 closed after the cached-token pricing contract,
  provider normalization, runtime persistence, and independent ledger lifecycle were frozen and
  merged. #249 may consume that accepted persistence boundary without redefining cost semantics.
- **Observed correction (2026-07-25):** PR #297 merged #249's schema-first private cost-summary,
  reconciliation, budget-event, and `cost.read` contract. Runtime budget observation and the
  permission-bound Ops consumer remain separate follow-up work.
- **Next observation:** verify OA-004's reported production migration before claiming the durable
  database is current, complete OA-012/OA-013 before claiming either Redis guard is production-ready,
  complete P0-12 against the merged #75 routes, and preserve the accepted #248/#297 cost contracts in
  all consumers. Keep trigger-gated Phase 1/2/3 rollout and payment work blocked until their explicit
  evidence gates are met.
- **Observed correction (2026-08-20):** ADR-0023 and PR #522 narrowed product delivery around the
  VisePanda Chatbot and six execution moments. This section now preserves the completed Phase 0
  foundation as history while Section 2 is the only current implementation queue. FOCUS-01 owns the
  matching GitHub reclassification; no Content AI, VisePod, marketplace, SEO expansion, or mobile-scale
  issue may bypass the scoped-fact and vertical-slice order.
