# Iteration Constraints

Status: active

- Work MUST follow the lifecycle gates in the overall design baseline and 钱学森 Skills.
- Every normal PR MUST reference an accepted Issue and classify its observed deviation D0-D3.
- The Issue MUST remain executable without hidden chat history.
- A PR MUST update mapped documentation and regenerate the index when registry content changes.
- Domain/interface changes MUST precede and unblock consumer changes; they MUST NOT be hidden in a UI PR.
- Prompt/model/router changes MUST run relevant evals and report cost/quality implications.
- Schema/migration/permission changes MUST run relevant database and RLS contract checks.
- A failed check MUST NOT be described as passed; residual risk and blockers must be explicit.
- A merged change requiring production observation MUST retain a named follow-up owner and review date.
- Phase 1/2/3 scope MUST NOT start before its accepted trigger unless an ADR changes the trigger.

Verification: Issue and PR templates, CI, reviewer checklist, release review, and `pnpm docs:impact`.
