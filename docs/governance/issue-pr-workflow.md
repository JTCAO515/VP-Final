# Issue and Pull Request Workflow

Status: active

GitHub Issues are control actions. Pull requests are evidence packages that implement and verify
those actions.

## Issue Lifecycle

1. **Observation:** record current evidence, not only a desired feature.
2. **Triage:** classify C0-C4 and D0-D3; identify objective and subsystem.
3. **Design:** define interface impact, risks, owner, dependencies, and rollback.
4. **Ready:** acceptance is executable without private chat context; scope is at most L.
5. **In progress:** one owner/Agent, one branch, no unrelated work.
6. **Review:** PR links the Issue and supplies code, docs, tests, and deviation comparison.
7. **Observed:** production/operations follow-up runs when required.
8. **Closed:** lifecycle Gate G6 records learning or explicit no-action.

## PR Lifecycle

### Before editing

- inspect `git status`, branch, Issue, interface authority, and relevant docs;
- confirm dependencies and do-not-touch boundaries;
- stop and escalate if a D2/D3 deviation invalidates the Issue.

### Before review

- keep the diff focused;
- update mapped non-generated docs;
- run relevant checks and paste concise evidence;
- state observed result versus target, residual risk, rollback, and follow-up window.

### Handoff and generated Index serialization

- Every implementation PR MUST state its expected handoff delta in the PR template, but MUST NOT edit
  `docs/handoff.json` or generated `docs/INDEX.md` merely to describe an unmerged branch.
- After an authorized maintainer merges a batch or a D2/D3 control action, the documentation owner
  creates one focused, `main`-based snapshot-refresh action. It records only merged facts, regenerates
  `docs/INDEX.md`, and passes documentation checks.
- A PR that changes `docs/handoff.json`, `docs/manifest.json`, or document authority MUST regenerate
  `docs/INDEX.md`. Generated output is never hand-edited.
- This serialization prevents conflicting speculative snapshots. PR comments and the linked Issue
  remain the evidence for in-review work until the post-merge snapshot records it.

### Merge gate

A PR may merge only when:

- the Issue is accepted and dependency state is correct;
- interface owners reviewed C2/C3 changes;
- required CI is green;
- docs check/impact is green;
- permissions, commercial tracking, evals, migrations, and runbooks are addressed where relevant;
- no known unclassified deviation remains.

Only an architect or operator may approve and merge an implementation PR. The PR author and any
implementation Agent MUST NOT approve or merge their own PR, even when all checks are green. The
independent reviewer MUST inspect the checks, Issue acceptance, diff scope, and these invariants before
merging: AI does not directly write user data; commercial links require explicit commerce intent and the
outbound gateway; money-adjacent changes have ledger/telemetry evidence; identity is server-trusted;
and deployed modes never present mock success as production truth.

## Multi-Agent Rules

- Parallel Agents may work only on disjoint modules or against a frozen interface baseline.
- One Agent owns a branch/PR at a time unless an explicit handoff is recorded.
- An Agent must not infer completion from another Agent's message; inspect the merged commit/API.
- Findings belong in the Issue/PR/repository, not only in an AI conversation.
- Architecture review resolves interface conflict; model majority does not.

## Emergency Fix

Use the emergency exception only for an active production outage or integrity incident. Restore the
smallest safe behavior, then complete the missing artifacts within 24 hours under QSE-020.
