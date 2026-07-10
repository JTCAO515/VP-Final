# Web Deploy and Rollback Runbook

Status: active
Owner: operator / platform engineer

## Purpose and Trigger

Deploy `apps/web` through the linked Vercel project, verify the public critical path, or roll back a
bad deployment. This runbook describes the current Git-linked Next.js flow; update it when deployment
ownership or topology changes.

## Preconditions

- Reviewed commit on the intended branch.
- Vercel project root/framework/build settings match `apps/web` and the monorepo.
- Required environment variable names are configured in Vercel; never paste values into evidence.
- Database migrations required by the commit are applied first.

## Procedure

1. Run locally:

   ```bash
   pnpm install --frozen-lockfile
   pnpm --filter @visepanda/app-web typecheck
   pnpm --filter @visepanda/app-web test
   pnpm --filter @visepanda/app-web build
   pnpm docs:check
   ```

2. Push the reviewed commit and let the Git-linked Vercel project create a preview deployment.
3. Inspect build logs for the exact commit SHA and framework/root selection.
4. Smoke test homepage, Copilot degraded/success behavior, Explore, one guide, Human Help, and an
   outbound denial/safe redirect path as applicable.
5. Promote/merge only after smoke evidence is attached to the PR or release record.

## Verification

- Public URL serves the expected commit, not a bootstrap placeholder.
- No horizontal overflow or broken primary navigation on desktop/mobile.
- Missing backend/provider configuration is reported honestly.
- Sentry/logging receives a controlled test error when observability is active.

## Rollback

1. In Vercel, select the last verified production deployment and redeploy/promote it.
2. Do not roll back an already-applied migration by editing migration history.
3. If schema compatibility blocks rollback, deploy a forward-compatible repair or disable the feature.
4. Record incident, affected SHA, observation, D1-D3 classification, and follow-up Issue.

## Evidence to Retain

Build URL/log excerpt, commit SHA, smoke checklist, deployed URL, rollback target, and any deviations.
