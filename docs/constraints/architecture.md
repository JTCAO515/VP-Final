# Architecture Constraints

Status: active

## System Shape

- The repository MUST remain a TypeScript monorepo and modular monolith until an accepted ADR proves
  that a separate deployable service is required.
- `packages/domain` MUST own cross-module schemas, state machines, and pure business rules.
- Applications MUST depend inward on packages; domain MUST NOT import an application or provider.
- Server modules MUST interact through exported service interfaces and MUST NOT query another
  module's tables directly.
- UI surfaces MUST NOT become alternate authorities for domain enums or business state.

## Product Invariants

- AI MUST only produce typed envelopes and TripPatch values; deterministic code MUST apply changes.
- Trip events MUST be append-only where event persistence is active.
- Execution facts MUST retain source, confidence, verification time, and freshness semantics.
- Public facts, AI citations, and indexable guidance MUST meet [ADR-0006](../adr/ADR-0006-knowledge-evidence-and-index-quality.md); missing or conflicting evidence is omitted or reported as unknown.
- Commercial links MUST pass through the outbound gateway and only active partners may be public.
- Human Task transitions MUST use the accepted domain state machine.

## Verification

- Module and dependency tests.
- Domain schema and contract tests.
- Architecture review for any new service, datastore, cross-module table access, or interface break.
- `pnpm docs:impact` for corresponding architecture/module documentation.
