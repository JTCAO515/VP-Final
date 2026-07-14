# Pull Request

## Issue

Closes #

## Objective, subsystem, and deviation

<!-- accepted objective; subsystem; expected vs observed; D0/D1/D2/D3 -->

## Assumptions and simplest sufficient design

<!-- material assumptions; high-risk decisions; why this is the minimum implementation -->

## What changed

## Contracts changed

<!-- domain schema / API router / events — link the standalone domain PR if any -->

## Tests

<!-- unit / contract / screenshots if UI -->

## Evals

<!-- required if prompts/models/routing touched; paste run result -->

## Commercial tracking

<!-- events/ledger entries added or changed, or "none" -->

## Rollback plan

## Documentation impact

<!-- list registered docs changed and why; generated INDEX alone is not sufficient -->

## Handoff synchronization

<!-- State the expected post-merge handoff delta. Only a serialized snapshot-refresh PR edits
docs/handoff.json and regenerates docs/INDEX.md. -->

## Operator actions

<!-- none | register rows added/updated; placeholders only; disclose real vs mock verification -->

## Lifecycle follow-up

<!-- Gate closed; production observation owner/date, or "none — complete at merge" -->

## Self-check

- [ ] Scope is one reviewable control action; no unrelated cleanup.
- [ ] Every changed line traces to Issue scope, acceptance evidence, or cleanup caused by this change.
- [ ] No speculative feature, configurability, abstraction, dependency, or adjacent refactor was added.
- [ ] Each implementation step has reproducible verification; unexpected complexity is reduced or justified.
- [ ] Interface baseline and consumers were reviewed when applicable.
- [ ] Source changes update mapped documentation.
- [ ] Expected handoff delta is recorded; ordinary implementation PRs do not edit the shared snapshot.
- [ ] If this is a snapshot/registry/authority refresh, `docs/handoff.json` and generated Index reflect merged truth.
- [ ] Missing data and unavailable dependencies fail/degrade honestly.
- [ ] External manual work is registered with owner/status/verification/rollback; no secret is present.
- [ ] Unrun checks and residual risk are disclosed.
- [ ] `pnpm docs:check` and `pnpm docs:impact -- --base <ref>` pass.
