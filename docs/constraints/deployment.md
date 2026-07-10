# Deployment Constraints

Status: active

- Production deploys MUST originate from reviewed repository commits and reproducible CI builds.
- Environment secrets MUST live in deployment secret stores; documentation lists names only.
- Preview, staging-equivalent, and production configuration MUST have explicit ownership and must not
  silently share mutable test data.
- A database migration MUST be applied and verified before code that requires it is promoted.
- Deployments MUST have health/smoke evidence, observability, and a rollback procedure.
- Missing required configuration MUST produce a failed or degraded health state and an honest user
  error, not a mock result.
- Feature flags MUST have owner, default, exposure rule, expiry/review date, and rollback behavior.
- Rollback MUST NOT reverse an already-applied destructive data change; migrations require a forward
  recovery plan.

Verification: CI, environment review, deployment runbook, smoke test, migration contract, and release
record.
