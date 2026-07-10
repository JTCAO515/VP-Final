# Handoff Snapshot Workflow

Status: active

`docs/handoff.json` is the structured current-state snapshot rendered at the top of
`docs/INDEX.md`. It lets a new human or coding Agent understand what is active, what was last
verified, what is blocked, what comes next, and which Markdown documents to read first.

## Mandatory Update Rule

Every repository change MUST update `docs/handoff.json`, including code, configuration,
documentation, workflow, dependency, planning, and operational changes. Generated `docs/INDEX.md`
does not count as the handoff source.

Update only facts changed by the PR:

- `updatedAt` and `updatedBy`;
- `lastVerifiedCommit` when full verification was run against a commit;
- current phase, maturity, and last completed control action;
- active branches/PRs and their next action;
- ordered next actions and exit criteria;
- blockers removed, added, or reclassified;
- verification evidence;
- reading order when document authority or project structure changes.

## Handoff Procedure

1. Inspect `main`, current git state, open PRs/Issues, and relevant deployed state.
2. Compare the accepted objective with current evidence; do not copy stale status forward.
3. Update `docs/handoff.json` in the same PR as the project change.
4. Run `pnpm docs:index`; never hand-edit `docs/INDEX.md`.
5. Run `pnpm docs:check` and `pnpm docs:impact -- --base <ref>`.
6. In the PR, state what changed in the handoff and whether a production observation remains.

## Truthfulness Rules

- “Open,” “merged,” “deployed,” “verified,” and “production-ready” are different states.
- An Issue title or Agent message is not evidence that its dependency is merged.
- Record the commit used for full verification; do not advance it after docs-only checks.
- Remove completed work from `activeWork` and reflect it in `lastCompleted`.
- Keep no more than the immediate execution horizon in `nextActions`; the complete backlog belongs
  in GitHub Issues.
- Never place credentials, user data, private transcripts, or provider payloads in the handoff.

## CI Enforcement

`pnpm docs:check` validates the handoff schema and reading-order paths. `pnpm docs:impact` rejects
any meaningful repository change that does not include `docs/handoff.json`, while still requiring a
separate mapped Markdown update for source/config changes.
