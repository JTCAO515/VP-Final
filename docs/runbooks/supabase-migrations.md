# Supabase Migration Runbook

Status: active
Owner: operator / data-platform engineer

## Purpose and Trigger

Create, verify, apply, or recover from a migration under `infra/supabase/migrations`.

## Preconditions

- Supabase CLI installed and authenticated for the intended project.
- Correct project linked; confirm project ref without printing credentials.
- Migration is additive/forward-compatible where practical and has reviewed RLS behavior.
- Backup/recovery impact is understood for destructive data operations.

## Local Procedure

```bash
supabase start --workdir infra
supabase db reset --local --no-seed --workdir infra
supabase test db supabase/tests/database --local --workdir infra
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  pnpm --filter @visepanda/app-server exec vitest run \
    src/db/versionedTripService.integration.test.ts \
    src/db/opsAuthorizationService.integration.test.ts
supabase db advisors --local --type security --level warn --fail-on error --workdir infra
```

Run database contract/RLS tests defined by the repository. Inspect policies using authenticated and
anonymous roles, not only service-role access.

Docker Desktop (or a compatible running Docker daemon) is required by local Supabase. If unavailable,
record the exact failure and rely on the same commands in CI Database contracts; do not claim a local
database pass.

## Remote Apply

1. Fetch remote migration state and verify local/remote ordering.
2. Review the exact SQL diff and target project.
3. Apply with the Supabase CLI from `infra/supabase` using the linked project.
4. Save command output without tokens or connection strings.
5. Run server integration and public/denied access checks.

## Verification

- Migration appears once in remote history.
- Required tables, constraints, indexes, triggers, and policies exist.
- Anonymous/user/operator behavior matches permission constraints.
- Existing version of the application remains compatible during rollout.

## Failure Recovery

Never edit or delete a landed migration. Add a new forward repair migration. For data loss or unsafe
policy exposure, disable the affected route/flag, preserve evidence, restore from approved backup if
necessary, and open a D2/D3 incident review.
