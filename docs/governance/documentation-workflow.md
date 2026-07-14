# Documentation Workflow

Status: active
Decision: [ADR-0002](../adr/ADR-0002-documentation-as-code.md)

Documentation is part of the controlled system. It describes current behavior, fixes mandatory
constraints, records decisions, guides operations, and preserves evidence. A source change without
its mapped document change is incomplete.

## 1. Choose the Right Document

| Need | Document class | Update behavior |
| --- | --- | --- |
| Explain current system/module | explanation | edit in the same PR as code |
| Impose a mandatory rule | constraint | use normative language and verification |
| Change a binding direction | ADR | create/supersede; do not rewrite accepted history |
| Execute an operation | runbook | test the procedure and update with operational change |
| Define terms/commands/index | reference | generate when possible |
| Propose future work | planning | date and status; do not present as shipped |
| Set visual/product behavior | design | update the canonical design document only |
| Explain the engineering reasoning system | methodology | change through governance review |

## 2. Update Loop

1. Classify the code/config change using [change classification](change-classification.md).
2. Identify mapped documents in `docs/manifest.json`.
3. Update the smallest document that will become false after the source change.
4. If a binding direction changes, add an ADR before changing constraints.
5. Update the manifest when adding, moving, archiving, or changing ownership/status.
6. In an implementation PR, state the expected handoff delta but leave the merged-state snapshot to the
   serialized refresh procedure in [Handoff Snapshot Workflow](handoff-workflow.md).
7. When the snapshot, registry, or document authority changes, run `pnpm docs:index`; otherwise do not
   commit generated Index churn.
8. Run `pnpm docs:check` and `pnpm docs:impact -- --base <ref>` against the intended merge base.
9. List the documents, expected handoff delta or completed refresh, and observed deviation in the PR.

## 3. Required Writing Properties

- State current facts separately from planned behavior.
- Use canonical terms from `CONTEXT.md`.
- Name exact files, commands, actors, inputs, outputs, failure states, and rollback steps.
- Constraints use `MUST`, `MUST NOT`, or `REQUIRED` and identify a check or reviewer gate.
- Avoid duplicating full schemas; link to the authority and explain semantics.
- External claims cite primary/owner sources where available.
- Historical plans remain dated and marked `historical` instead of being silently rewritten.

## 4. Registry and Index

`docs/manifest.json` is the registry; `docs/INDEX.md` is its generated human view.

The registry records:

- path and title;
- category and document class;
- lifecycle status;
- owner;
- one-sentence summary;
- source prefixes whose changes require this document to be considered.

The checker rejects orphan Markdown, missing files, invalid metadata, broken local links, duplicate
paths, or a stale generated index. `docs/INDEX.md` must never be edited manually.

The Index also renders `docs/handoff.json`. The snapshot is refreshed after authorized merges or a
material D2/D3 observation so it remains factual without making parallel implementation PRs overwrite
one another. See the [handoff workflow](handoff-workflow.md).

## 5. Review and Freshness

- Module owners review their active explanation/constraint/runbook documents when their source area
  changes.
- The overall design baseline is reviewed on D2/D3 deviations and at release retrospectives.
- Runbooks are reviewed after use, incident, provider change, or every six months if still active.
- A document with no current owner is a defect; assign or archive it.
- Deleting source requires removing or remapping obsolete documentation in the same program of work.

## 6. Emergency Path

For an active production incident, service restoration may precede normal documentation. Within 24
hours, add the Issue, tests, mapped document update, deviation classification, and retrospective.
All security, data-integrity, payment, and truthfulness constraints remain active during emergencies.
