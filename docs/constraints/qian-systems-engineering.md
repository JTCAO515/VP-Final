# JTCoding Skills Constraints

Status: active
Methodology: [JTCoding Skills](../methodology/qian-systems-engineering.md)

These rules are normative. Automated rules fail CI; semantic rules are mandatory review gates.

| ID | Mandatory rule | Verification | Required evidence |
| --- | --- | --- | --- |
| QSE-001 | Every non-emergency change MUST reference one GitHub Issue and one accepted overall objective. | PR review | completed Issue and PR fields |
| QSE-002 | An Issue MUST name its subsystem, scope, do-not-touch boundary, dependencies, acceptance, observations, risk, and documentation impact. | Issue triage | accepted Issue template |
| QSE-003 | Work estimated above five focused days MUST be decomposed before implementation. | triage review | child Issues or written exception |
| QSE-004 | Cross-module schemas, APIs, events, migrations, and state machines MUST be reviewed as interface baselines before parallel consumer work. | architecture review | contract PR/test or accepted ADR |
| QSE-005 | A consumer PR MUST NOT silently introduce a breaking interface change. | contract tests + review | compatibility result |
| QSE-006 | Source/config changes MUST update at least one mapped, non-generated document in the same PR. | `pnpm docs:impact` | changed registered document |
| QSE-007 | All controlled Markdown MUST be registered; `docs/INDEX.md` MUST be generated and current. | `pnpm docs:check` | passing CI |
| QSE-008 | Explanatory docs MUST distinguish implemented behavior, placeholder behavior, and planned behavior. | doc review | explicit status language |
| QSE-009 | Decisions that alter product invariants, architecture, permissions, commercial policy, or lifecycle gates MUST use an ADR. | review | accepted/superseding ADR |
| QSE-010 | AI-generated analysis MUST be treated as a hypothesis until supported by source, code, test, query, or operational evidence. | review | cited evidence |
| QSE-011 | Multiple model outputs MUST NOT be treated as a vote or independent factual confirmation. | review | synthesis records evidence and dissent |
| QSE-012 | Every control objective MUST name an observation, owner, and review cadence. | overall-design review | objective table |
| QSE-013 | Every observed mismatch MUST be classified D0-D3 before choosing a control action. | PR/incident review | deviation field |
| QSE-014 | D2 changes MUST pause scope expansion and require architecture/contract review. | reviewer gate | ADR, contract PR, or approved review |
| QSE-015 | D3 changes MUST be decided by the operator and amend or supersede the frozen baseline. | governance review | operator decision + ADR/baseline amendment |
| QSE-016 | An implementation MUST include the broadest relevant tests and reproducible evidence; unrun checks MUST be disclosed. | CI + PR review | command output/blocker |
| QSE-017 | Production capability MUST have an owner, observability, degraded behavior, and rollback procedure before release. | release gate | runbook + smoke result |
| QSE-018 | A temporary mock or in-memory adapter MUST be labelled and MUST NOT be represented as production persistence or a real external call. | module/UI/PR review | explicit maturity note |
| QSE-019 | Security, privacy, payment integrity, TripPatch, knowledge provenance, and outbound audit constraints MUST NOT be waived for schedule pressure. | security/business review | passing checks + no bypass |
| QSE-020 | Emergency recovery MAY precede normal artifacts only to restore service; the Issue, docs, tests, and review MUST be completed within 24 hours. | incident review | timestamped follow-up PR |
| QSE-021 | Merge MUST NOT be treated as completion when a production observation window or operational acceptance is required. | release review | follow-up owner/date |
| QSE-022 | Retrospective conclusions MUST become a registered document update, Issue, ADR, eval, fact, or explicit no-action record. | lifecycle Gate G6 | repository/GitHub link |
| QSE-023 | Removal or retirement MUST update documentation, index mappings, flags, data retention, and runbooks in the same change program. | docs impact + review | retirement checklist |
| QSE-024 | Agent tasks MUST use the minimum authoritative context pack and MUST inspect current git state before editing. | PR review | source references and clean scope |
| QSE-025 | Unrelated cleanup MUST NOT be bundled into a control action; one PR changes one reviewable behavior or baseline. | reviewer gate | focused diff |
| QSE-026 | Every repository change MUST update `docs/handoff.json`; the generated Index MUST expose current work, blockers, verification, next actions, and Markdown reading order. | `pnpm docs:check` + `pnpm docs:impact` | synchronized handoff and Index |
| QSE-027 | Material assumptions and competing interpretations MUST be surfaced before implementation; high-risk ambiguity MUST be resolved by the accountable operator. | Issue/PR review | assumptions and decision record |
| QSE-028 | Implementation MUST use the simplest sufficient design that satisfies accepted interfaces and evidence; speculative scope, configurability, abstraction, and dependencies are prohibited. | focused diff + architecture review | minimal design or complexity justification |
| QSE-029 | Every changed line MUST trace to the Issue, acceptance evidence, or cleanup caused by the change; adjacent refactors and pre-existing dead-code removal require separate scope. | reviewer gate | line-level focused diff |
| QSE-030 | Every implementation step MUST bind to a reproducible verification and continue until criteria pass or an honest blocker is recorded. | CI + PR review | step/check evidence |
| QSE-031 | When local simplicity conflicts with security, privacy, data/payment integrity, accepted contracts, or repository constraints, the stricter system invariant MUST win. | architecture/security review | invariant and decision evidence |

## Emergency Exception

Only restoration of an active production incident qualifies. The exception does not permit secret
leakage, destructive migration, fabricated success, direct Trip mutation, unauthorized access, or
untracked money movement. Those actions remain prohibited under all conditions.
