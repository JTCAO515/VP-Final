# VisePanda Documentation

This directory is the project knowledge base. Start with the generated [documentation
index](INDEX.md). Its first sections contain the current handoff snapshot and mandatory Markdown
reading order; only then follow the task-specific route.

## Reading Routes

| Reader | Read in this order |
| --- | --- |
| New engineer or agent | [Index handoff/reading order](INDEX.md) → [`CONTEXT.md`](../CONTEXT.md) → [overall design](architecture/top-level-design.md) → relevant module/constraint/Issue |
| Feature implementer | Relevant module doc → [development standard](standards/development.md) → [iteration constraints](constraints/iteration.md) → assigned Issue |
| API or schema author | [domain module](modules/domain.md) → [API constraints](standards/api-contracts.md) → [architecture constraints](constraints/architecture.md) |
| Security or data work | [data platform](modules/data-platform.md) → [permission constraints](constraints/permissions.md) → [Supabase runbook](runbooks/supabase-migrations.md) |
| Operator | Relevant runbook → [deployment constraints](constraints/deployment.md) → [commercial](commercial/README.md) or [compliance](compliance/README.md) docs |
| Product or planning | [frozen baseline](planning/visepanda-v2-final-architecture.md) → dated project review → GitHub Issues |

## Document Classes

| Class | Purpose | Normative? | History rule |
| --- | --- | --- | --- |
| Explanation | Describe architecture, modules, and current behavior | No, unless it links to a constraint | Update with code |
| Constraint | Define mandatory `MUST`/`MUST NOT` behavior and checks | Yes | Change through review; use ADR when direction changes |
| ADR | Record a binding decision and consequences | Yes when accepted | Append-only; supersede, never rewrite history |
| Runbook | Execute deployment, recovery, review, or operations | Yes for the named operation | Update when the procedure changes |
| Reference | Define terms, indexes, commands, and schemas | Yes where stated | Generated references must not be hand-edited |
| Planning | Explain future sequencing and hypotheses | No | Date snapshots; do not silently present plans as shipped |
| Design | Define brand and interaction behavior | Canonical design doc only | Mark alternatives as historical |

## Source of Truth

- [`docs/manifest.json`](manifest.json) is the machine-readable document registry.
- [`docs/handoff.json`](handoff.json) is the mandatory current-state and reading-order source.
- [`docs/INDEX.md`](INDEX.md) is generated; run `pnpm docs:index` instead of editing it.
- `pnpm docs:check` rejects missing registry entries, orphan documents, broken local links, invalid
  metadata, and a stale index.
- Local link extraction is implemented as a linear scan in `scripts/docs/lib.mjs` so malformed or
  long Markdown fragments cannot stall documentation checks.
- `pnpm docs:impact -- --base <git-ref>` rejects source changes that do not update at least one
  mapped document.
- [ADR-0002](adr/ADR-0002-documentation-as-code.md) makes this workflow a permanent engineering
  baseline.

## Status Language

- `active`: current operational guidance.
- `accepted`: binding decision.
- `frozen`: approved baseline changed only through an explicit amendment or superseding ADR.
- `draft`: useful but not yet binding.
- `historical`: retained for traceability; never use as current implementation guidance.

## Editing Rule

Every repository change updates `docs/handoff.json`; source/config changes also update the smallest
mapped Markdown document. Regenerate the Index, run the document checks, and list both updates in
the PR.
