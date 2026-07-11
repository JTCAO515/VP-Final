# Documentation Templates

Status: active

Use the smallest template that preserves authority, evidence, and history.

## Explanation

```markdown
# Title

Status: active

## Purpose

## Current implementation

## Boundaries and dependencies

## Runtime/data flow

## Failure and degraded behavior

## Production gaps

## Tests and operations

## Related decisions and constraints
```

## Constraint

```markdown
# Title Constraints

Status: active

| ID       | Mandatory rule | Verification          | Required evidence |
| -------- | -------------- | --------------------- | ----------------- |
| AREA-001 | ... MUST ...   | command/reviewer gate | artifact          |
```

## ADR

```markdown
# ADR-NNNN: Decision

Status: proposed | accepted | superseded
Date: YYYY-MM-DD
Deciders: roles

## Context and observed deviation

## Decision

## Alternatives considered

## Consequences

## Control measures and rollback

## Documentation and migration impact
```

## Runbook

```markdown
# Operation Runbook

Status: active
Owner: role

## Purpose and trigger

## Preconditions

## Safety checks

## Procedure

## Verification

## Failure recovery / rollback

## Evidence to retain

## Last exercised
```

## Review / Research

```markdown
# Topic Review

Date: YYYY-MM-DD
Status: draft | historical

## Question and decision boundary

## Sources and research limitations

## Observations

## Synthesis, dissent, and confidence

## Deviation classification

## Recommended control actions

## Unknowns and review date
```

## Release Retrospective

```markdown
# Release Retrospective

## Objectives and observation window

## Expected vs observed

## D0-D3 deviations

## Continue / adjust / rollback / retire

## Knowledge captured

## Follow-up Issues, ADRs, evals, facts, or no-action reason
```

## Operator Action

Register external work in the authoritative register rather than creating an isolated private list:

```text
ID / status / capability / associated Issue
purpose / owner / environment / prerequisite
named placeholders (never values)
exact operator action
unblock condition / verification evidence
rollback / last reviewed
```

When requested or when the objective reaches its release gate, instantiate the registered
[beginner tutorial template](operator-action-tutorial-template.md). The tutorial may name fields and
menus but MUST NOT contain secret values.

## Handoff Snapshot

Keep this content in the repository's structured handoff source and generate it into the Index:

```text
updatedAt / updatedBy / baseBranch / lastVerifiedCommit
currentPhase / maturity / lastCompleted
activeWork: ref / title / state / owner / next
nextActions: priority / action / exitCriteria
blockers
verification
readingOrder: registered document path / reason
```

Update it for every repository change. Keep the full backlog in GitHub; the handoff contains only
the immediate execution horizon.
