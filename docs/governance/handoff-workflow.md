# Handoff Snapshot Workflow

Status: active

`docs/handoff.json` is the structured current-state snapshot rendered at the top of
`docs/INDEX.md`. It lets a new human or coding Agent understand what is active, what was last
verified, what is blocked, what comes next, and which Markdown documents to read first.

## Serialized Update Rule

`docs/handoff.json` records merged repository truth, not a collection of speculative branch states.
Every implementation PR MUST describe its expected handoff delta in the PR, but MUST NOT edit the
snapshot or its generated `docs/INDEX.md` solely because the branch is in review. This prevents
parallel PRs from overwriting each other's current-state evidence.

After an authorized merge batch, release decision, or D2/D3 observation, the documentation owner MUST
make one serialized, `main`-based handoff refresh. Generated `docs/INDEX.md` does not count as the
handoff source and must be regenerated whenever the snapshot changes.

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

1. In an implementation PR, inspect `main`, current state, the Issue, and deployed evidence; state the
   expected handoff delta without editing the snapshot.
2. After authorized merges, open the serialized refresh from current `main`; inspect the merged commits,
   open PRs/Issues, and relevant deployed state.
3. Compare the accepted objective with evidence; do not copy stale status forward.
4. Update `docs/handoff.json`, then run `pnpm docs:index`; never hand-edit `docs/INDEX.md`.
5. Run `pnpm docs:check` and `pnpm docs:impact -- --base <ref>`.
6. In the refresh PR, state the merged changes represented, remaining production observations, and the
   next execution horizon.

## Truthfulness Rules

- “Open,” “merged,” “deployed,” “verified,” and “production-ready” are different states.
- An Issue title or Agent message is not evidence that its dependency is merged.
- Record the commit used for full verification; do not advance it after docs-only checks.
- Remove completed work from `activeWork` and reflect it in `lastCompleted`.
- Keep no more than the immediate execution horizon in `nextActions`; the complete backlog belongs
  in GitHub Issues.
- Never place credentials, user data, private transcripts, or provider payloads in the handoff.

## CI Enforcement

`pnpm docs:check` validates the handoff schema, reading-order paths, and generated Index. `pnpm
docs:impact` requires a mapped Markdown update for source/config changes, but does not require the
serialized snapshot in every implementation PR. The merge reviewer enforces the expected-handoff-delta
template; the refresh PR closes that delta with merged evidence.
