# ADR-0002: Documentation as a controlled engineering system

Date: 2026-07-10
Status: Accepted

## Context

VisePanda is developed by humans and multiple coding Agents across product, domain, server, Web,
Ops, data, AI, and commercial work. Existing Markdown is useful but has no complete registry,
freshness check, code-impact mapping, or shared truth hierarchy. This allows code, plans, and agent
context to drift apart.

## Decision

- `CONTEXT.md` owns canonical project language.
- `docs/manifest.json` registers every controlled Markdown document.
- `docs/INDEX.md` is generated from the registry and is not hand-edited.
- CI validates registry coverage, metadata, local links, index freshness, and source-to-document
  impact.
- Source/config changes require at least one mapped non-generated document update.
- Documentation is split into explanation, constraint, ADR, runbook, reference, planning, design,
  and methodology classes with explicit lifecycle status.
- `AGENTS.md`, Issue templates, PR templates, and CODEOWNERS route work through this system.

## Alternatives Considered

- Rely on reviewer memory: rejected because it does not scale across Agents.
- Require a single large architecture document: rejected because ownership and freshness become
  ambiguous.
- Generate docs entirely from code: rejected because product intent, constraints, operations, and
  decision history are not derivable from source alone.

## Consequences

- Every implementation PR includes a documentation change.
- Adding or moving Markdown requires a registry update and regenerated index.
- CI gains a small maintenance cost but reduces rediscovery, contradiction, and unsafe agent work.
- Explanatory docs must state implementation maturity honestly; plans cannot stand in for shipped
  behavior.

## Control and Rollback

The checks are dependency-free Node scripts. If a checker blocks incorrectly, fix the manifest or
script in a focused PR; do not bypass the workflow. Emergency production restoration follows the
24-hour documentation exception in 钱学森 Skills.
