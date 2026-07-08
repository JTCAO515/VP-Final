# ADR-0001: New repository VP-Final; V1 line disposition

Date: 2026-07-07
Status: Accepted

## Context

V2 is a greenfield rebuild (frozen baseline: `docs/planning/visepanda-v2-final-architecture.md`).
Hard-decision issue VP-Codex-Final#169 listed D1 (repo choice) and D2 (V1 disposition) as
blockers for bootstrap.

## Decision

- **D1 (decided by operator, 2026-07-07): new standalone repository `JTCAO515/VP-Final`.**
  Clean history, no inheritance of V1 code/data/docs. The only import is the frozen
  baseline document, copied into `docs/planning/` as this repo's sole planning input.
- **D2 (working assumption, pending explicit operator confirmation): V1 repo
  (VP-Codex-Final) stops taking new feature issues; already-open work may be finished;
  V1 freezes when the V2 web MVP goes public.** Recorded here so agents don't dispatch
  new V1 work by default; operator can override in #169.

## Consequences

- All V2 development happens here. Baseline amendment rules apply (Appendix A of the
  baseline: only real user data or hard-decision closure can change it, diff-format only).
- Apps are placeholder TS entries for now; real scaffolds (Next.js / Expo) land with
  their first feature issues rather than in the bootstrap, keeping Issue #1 reviewable.
