# Architecture Documentation

Architecture documents explain the system as it exists and identify its intentional boundaries.
Binding rules are kept separately under [`docs/constraints`](../constraints/README.md).

- [Overall design baseline](top-level-design.md): objectives, controlled subsystems, interfaces,
  observations, and lifecycle gates.
- [System overview](system-overview.md): product-to-system map and major runtime components.
- [Repository structure](repository-structure.md): package ownership and current maturity.
- [Runtime and data flows](runtime-data-flows.md): Copilot, Trip, knowledge, commerce, and task flows.
- [Runtime mode and adapter inventory](runtime-adapter-inventory.md): explicit modes, safe
  diagnostics, durable owners, and canonical follow-ups.
- [Dependency rules](dependency-rules.md): allowed and forbidden module dependencies.

Architecture direction changes require an ADR. Implementation detail changes update the relevant
architecture and module docs in the same PR.
