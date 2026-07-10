# Development Standard

Status: active

## Work Sequence

1. Read the assigned Issue and the minimum context pack defined by 钱学森 Skills.
2. Inspect the current branch, diff, module, tests, and authoritative schemas.
3. Establish a failing test, reproduction, contract example, or acceptance fixture.
4. Make the smallest implementation that satisfies the accepted objective.
5. Update the mapped documentation in the same PR.
6. Run the broadest relevant checks and record anything not run.
7. Compare observations with acceptance, classify deviations, and update the PR.

## Scope Discipline

- One PR changes one reviewable behavior, interface baseline, or operational procedure.
- Do not mix cleanup, dependency upgrades, formatting churn, or generated output unrelated to the
  assigned Issue.
- Cross-module work starts with a domain or contract change. Consumers follow only after the
  interface is reviewable.
- Preserve user changes in a dirty worktree. Never revert unrelated work to simplify a patch.

## Maturity Language

Use these exact labels in docs and PRs:

- `implemented`: executes the described behavior in the named runtime.
- `placeholder`: renders or models the flow but does not execute the external operation.
- `mock`: deterministic test/development data, clearly separated from production truth.
- `in-memory`: state does not survive process restart and is not production persistence.
- `planned`: accepted direction without implementation.
- `degraded`: real capability is unavailable and the product reports that honestly.

## Dependency Policy

- Prefer platform APIs and existing repository dependencies.
- Add a dependency only when it removes meaningful risk or complexity and has an owner.
- New runtime dependencies require license, maintenance, bundle/runtime cost, and rollback review.
- Never add a second library for a capability already owned by an accepted dependency without an ADR.

## Completion

“Done” means the relevant lifecycle gate has passed, not merely that code is committed. A production
flow also requires observability, rollback, and an owner.
