# Web Deploy and Rollback Runbook

Status: active
Owner: operator / platform engineer

## Purpose and Trigger

Deploy `apps/web` through the linked Vercel project, deploy `apps/web-v3` to its independent Preview,
verify the relevant critical path, or roll back a bad deployment. This runbook describes the current
monorepo Next.js topology; update it when deployment ownership changes.

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

## VP-V3 Preview Procedure

The isolated project is `vp-final-web-v3`, with Root Directory `apps/web-v3`, Next.js, Node 24, and
monorepo source files outside the root enabled. It has no `go2china.space` custom domain. The current
public project remains `vp-final-web` rooted at `apps/web`.

1. From a clean main-based repository, link the exact V3 project. Keep `.vercel/`, `.env.local`, and
   `.env.*.local` untracked; never print or retain their values.
2. Run the Web V3 local checks and the full repository gates.
3. Deploy with an explicit target:

   ```bash
   pnpm dlx vercel@59.3.0 deploy --yes --target preview --scope jtcao515s-projects
   ```

   Do not use a bare first `vercel deploy` for a newly created project: Vercel classifies the first
   deployment as `production` even without `--prod`.
4. Use `vercel inspect` and protected `vercel curl`; do not disable deployment protection.
5. Verify the expected commit/page, `noindex`, `robots.txt`, console/browser evidence, and the form's
   real or honest-unavailable state. Missing Preview database/Redis/Resend settings must remain 503.
6. Record only project/deployment ids, target/status, environment-variable names, sanitized HTTP
   outcomes, and verifier. Never retain email, address, key, cookie, bypass token, or provider id.

Current evidence: `dpl_3BRHwvfwgmK3vA12g7WU6nsEG7Bt` is Preview/Ready at the protected Vercel URL.
It has no Preview environment variables and returns `EARLY_ACCESS_UNAVAILABLE` by design. The first
bare deployment `dpl_Fdhxx7yJEVNT3BmBajsPLEsYhNXL` was auto-classified production on the isolated V3
project and has only the default `vp-final-web-v3.vercel.app` alias; it did not change the public Web.
See OA-033 before further configuration.

## Verification

- Public URL serves the expected commit, not a bootstrap placeholder.
- No horizontal overflow or broken primary navigation on desktop/mobile.
- Missing backend/provider configuration is reported honestly.
- A controlled render failure shows the recovery page with a fresh correlation id and no diagnostic
  content. Record only the correlation id and deployment SHA in evidence.
- If OA-008 has explicitly activated a monitoring adapter, its sanitized controlled-test event may be
  checked too. Its absence is not a deployment failure and must not be described as active monitoring.

## Rollback

1. In Vercel, select the last verified production deployment and redeploy/promote it.
2. Do not roll back an already-applied migration by editing migration history.
3. If schema compatibility blocks rollback, deploy a forward-compatible repair or disable the feature.
4. Record incident, affected SHA, observation, D1-D3 classification, and follow-up Issue.

For V3 before public cutover, rollback means stop using the Preview or remove its runtime variables
and redeploy an honest unavailable state. Do not promote, attach the public domain, remove the V3
project/alias, or change the current `vp-final-web` project without an explicit operator decision.

## Evidence to Retain

Build URL/log excerpt, commit SHA, smoke checklist, deployed URL, rollback target, and any deviations.
