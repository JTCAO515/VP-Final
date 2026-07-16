# Iteration Constraints

Status: active

- Work MUST follow the lifecycle gates in the overall design baseline and 钱学森 Skills.
- Every normal PR MUST reference an accepted Issue and classify its observed deviation D0-D3.
- The Issue MUST remain executable without hidden chat history.
- A PR MUST update mapped documentation and regenerate the index when registry content changes.
- Every repository change MUST synchronize `docs/handoff.json` and regenerate `docs/INDEX.md`,
  including documentation-only and governance changes.
- Domain/interface changes MUST precede and unblock consumer changes; they MUST NOT be hidden in a UI PR.
- Prompt/model/router changes MUST run relevant evals and report cost/quality implications.
- Schema/migration/permission changes MUST run relevant database and RLS contract checks.
- A durable lifecycle transition added to a server service MUST be exercised against the reset local
  Postgres database in the Database contracts CI job; an in-memory fixture or schema-only assertion is
  insufficient evidence that the migrated state can be written and read safely.
- A new durable cross-surface intake path MUST test both its server adapter and each production
  composition root that reads it. P0-13 therefore runs Human Task cold-start/ownership tests in the
  server and the Ops durable-store integration suite in the Database contracts job.
- A durable bulk-write path MUST include its Postgres integration test in the Database contracts job;
  unit parsing tests and a migration replay alone do not prove atomicity, concurrent idempotency, or
  downstream read visibility.
- The Database contracts gate MUST execute a nonzero pgTAP file and test count. `Result: NOTESTS` is
  a failed verification state even if the CLI process exits successfully.
- A failed check MUST NOT be described as passed; residual risk and blockers must be explicit.
- A merged change requiring production observation MUST retain a named follow-up owner and review date.
- Phase 1/2/3 scope MUST NOT start before its accepted trigger unless an ADR changes the trigger.

Verification: Issue and PR templates, CI, reviewer checklist, release review, and `pnpm docs:impact`.
