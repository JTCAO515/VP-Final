# Coding Constraints

Status: active

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

Verification: CI, secret scanning/review, focused diff review, migration contract tests, and dependency
review.
