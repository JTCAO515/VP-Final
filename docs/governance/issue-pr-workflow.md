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

Merge authority is assigned by risk tier. This classification changes who may merge; it does not lower
any CI, documentation, review, rebase, evidence, or interface gate above.

### Tier A: bounded self-merge when the architect is unavailable

An implementation Agent MAY self-merge a Tier A PR only when the architect is unavailable, every
required gate is green, and all four self-merge checks below pass. Tier A is limited to:

- pure documentation, draft ADRs that do not establish an accepted contract, and document-manifest
  registration;
- visual-only UI changes that do not change data flow or add clickable behavior;
- test-only additions, type fixes that preserve runtime behavior, and dependency-version alignment;
- a serialized `docs/handoff.json` and generated `docs/INDEX.md` refresh that records already-merged
  work.

If a PR contains any Tier B concern, the whole PR is Tier B. Splitting a high-risk change into a Tier A
wrapper does not change its classification.

### Tier B: independent architecture review required

The PR author and any implementation Agent MUST NOT approve or merge a Tier B PR, regardless of
architect availability, elapsed wait, or claimed urgency. Tier B includes:

- identity, authentication, authorization, permissions, RLS, Ops RBAC, and owner scoping;
- payments, billing, ledgers, provider pricing, metering, and cost-consumption or cost-accounting paths;
- user conversation content, PII, retention, redaction, deletion, and privacy boundaries;
- external promises or policy wording, including SLA, service boundaries, Human Help commitments, and
  emergency or medical statements;
- domain-schema changes and database migrations;
- AI pipeline invariants, including envelope validation, Patch application, `commerce_intent` gates,
  and provider routing;
- every Issue or observed change classified D2 or D3.

The independent reviewer MUST inspect the real checks, Issue acceptance, diff scope, and these
invariants before merging: AI does not directly write user data; commercial links require explicit
commerce intent and the outbound gateway; money-adjacent changes have ledger/telemetry evidence;
identity is server-trusted; and deployed modes never present mock success as production truth.

### Mandatory Tier A self-merge checks

Before a permitted Tier A self-merge, the Agent MUST:

1. verify the PR base is `main`; stacked PR bases remain forbidden;
2. inspect the provider's actual check-run conclusions and not rely on claims in the PR description;
3. rebase onto the latest `main`, then verify the checked head commit is still current;
4. state in the PR body: `Tier A self-merge; architect unavailable`, with the exact Tier A basis.

After the architect returns, they review a sample of Tier A PRs merged during the unavailable period.
If an audit finds that a self-merged PR was actually Tier B, record a D2 deviation and complete the
missing independent review and corrective action. A Tier B PR cannot use the emergency-fix process as
a self-merge exception.

## Multi-Agent Rules

- Parallel Agents may work only on disjoint modules or against a frozen interface baseline.
- One Agent owns a branch/PR at a time unless an explicit handoff is recorded.
- An Agent must not infer completion from another Agent's message; inspect the merged commit/API.
- Findings belong in the Issue/PR/repository, not only in an AI conversation.
- Architecture review resolves interface conflict; model majority does not.

## Emergency Fix

Use the emergency exception only for an active production outage or integrity incident. Restore the
smallest safe behavior, then complete the missing artifacts within 24 hours under QSE-020. This path
does not authorize an implementation Agent to self-merge a Tier B PR.
