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

Supabase SSR dependencies are server-side identity adapters. Their environment values remain deployment
secrets; a missing configuration may yield anonymous or unavailable state as defined by the active
runtime contract, never a client-supplied authenticated identity.

The Web identity environment contract is `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`VISEPANDA_ANON_SESSION_SECRET`, and `VISEPANDA_ANON_SESSION_KEY_ID`. A controlled signing-key rotation
temporarily adds `VISEPANDA_ANON_SESSION_PREVIOUS_SECRET` and
`VISEPANDA_ANON_SESSION_PREVIOUS_KEY_ID`. Setup and live verification are tracked as OA-001 through
OA-003 in the [operator action register](../governance/operator-action-register.md); values never enter
the repository.

## Dependency Policy

- Prefer platform APIs and existing repository dependencies.
- Add a dependency only when it removes meaningful risk or complexity and has an owner.
- New runtime dependencies require license, maintenance, bundle/runtime cost, and rollback review.
- Never add a second library for a capability already owned by an accepted dependency without an ADR.
- A workspace package may depend on another accepted workspace package when it consumes an existing
  contract; update `pnpm-lock.yaml` in the same PR and rebuild the provider package before checking
  a consumer, so stale generated declarations cannot hide or invent an export.
- An Expo shell MUST pin an Expo SDK-compatible React and React Native pair and keep its `app.json`
  explicit. A TypeScript or JS bundle check is not evidence of an iOS/Android simulator run; record
  missing Xcode/Android tooling honestly instead of labelling an unrun device check as passed.
- `expo-clipboard`, `expo-speech`, and `expo-file-system` are the accepted Expo SDK 55 dependencies
  for the current local mobile shell. Clipboard and Speech may copy or speak only an already-eligible
  ordinary fixed phrase; FileSystem may hold only a domain-validated, credential-free disposable
  offline cache. These modules do not authorize network translation, model-authored Chinese, a
  high-risk fallback, server synchronization, or a live language-service claim. Reverting their sole
  mobile consumers permits removing them.
- `expo-secure-store` is the accepted Expo SDK 55 storage owner for a mobile Supabase session. Its
  only accepted use is platform-secure access/refresh-token persistence; tokens MUST NOT enter the
  FileSystem offline cache, telemetry, logs, URLs, or screenshots. `@supabase/supabase-js` may use
  only the public `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` configuration to
  obtain that session and verify it through the server-owned mobile read path. Neither dependency
  authorizes direct Postgres, a service-role credential, or a mobile Trip write. Reverting the
  read-only mobile sync consumer permits removing both dependencies and the Expo SecureStore plugin.

## Completion

“Done” means the relevant lifecycle gate has passed, not merely that code is committed. A production
flow also requires observability, rollback, and an owner.

## AI Evaluation Gate

`pnpm evals` is a blocking CI gate, not an advisory model-quality sample. Changes to Copilot prompts,
model routing, envelope validation, citation checks, execution-fact support, or high-risk safety paths
must keep the deterministic safety runtime suite green alongside the Trip-generation golden set. The
suite exercises the real pipeline with controlled fixtures; it must not be weakened by replacing an
assertion with model output or by narrowing a safety input after a regression is discovered.

The gate also runs the deterministic Copilot policy-regression suite. It verifies that commercial
actions remain gated by `commerce_intent`, Human Help is only a reviewable draft, malformed or
business-invalid patches are rejected, insufficient verified knowledge stays honest, and medical or
legal-sensitive requests cannot bypass the fixed-expression safety path.
