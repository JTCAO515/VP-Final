# Coding Constraints

Status: active

Normative companion: [Karpathy Coding Discipline](karpathy-guidelines.md)

- Code MUST pass formatting/lint, typecheck, relevant tests, and build before merge.
- External, stored, model-generated, and environment data MUST be parsed at the boundary.
- Production paths MUST NOT fabricate success, POIs, prices, ratings, commissions, bookings, payments,
  citations, or persistence.
- Secrets and service-role credentials MUST NOT enter source, fixtures, screenshots, logs, PR text,
  or git history.
- Existing user work MUST NOT be reverted or overwritten unless explicitly requested.
- Landed database migrations MUST NOT be rewritten.
- Unrelated refactors and dependency updates MUST NOT be bundled with feature/fix work.
- Comments MUST explain non-obvious constraints or intent, not narrate syntax.
- New dependencies MUST have a documented reason, owner, license check, and rollback path.
- Material assumptions MUST be surfaced before implementation; high-risk ambiguity MUST be resolved
  by the responsible operator rather than silently guessed.
- Implementations MUST be the minimum sufficient change for the accepted Issue. Speculative features,
  flexibility, abstractions, and unrelated cleanup MUST NOT be added.
- Every changed line MUST trace to scope, acceptance evidence, or cleanup made necessary by the change.
- Each implementation step MUST name a reproducible verification; work continues until criteria pass
  or an honest blocker is recorded.

Verification: CI, secret scanning/review, focused diff review, migration contract tests, and dependency
review.
