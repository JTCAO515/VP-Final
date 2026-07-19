# ADR Index

Architecture Decision Records capture decisions that should not be re-litigated in ordinary PRs.
New ADRs are append-only and use the next numeric prefix.

| ADR | Status | Decision |
|---|---|---|
| [ADR-0001](ADR-0001-repo-and-v1-disposition.md) | Accepted | V2 lives in the standalone `JTCAO515/VP-Final` repository; V1 is a separate wind-down line. |
| [ADR-0002](ADR-0002-documentation-as-code.md) | Accepted | Documentation is registered, generated, impact-mapped, and checked as code. |
| [ADR-0003](ADR-0003-qian-systems-engineering-workflow.md) | Accepted | 钱学森 Skills is the permanent closed-loop engineering workflow. |
| [ADR-0004](ADR-0004-identity-trip-ownership-security.md) | Accepted | Server-verified identity, exclusive Trip ownership, read-only sharing, and optimistic concurrency are mandatory before public persistence. |
| [ADR-0005](ADR-0005-runtime-modes-and-production-adapter-ownership.md) | Accepted | Explicit runtime modes, single durable production ownership, and fail-closed truthfulness are mandatory before public persistence. |
| [ADR-0006](ADR-0006-knowledge-evidence-and-index-quality.md) | Accepted | Only reviewed/current evidence may power public facts, Copilot citations, or indexable guidance. |
| [ADR-0007](ADR-0007-agent-trace-privacy-retention.md) | Accepted | Server-only AI trace metadata is minimized, redacted, retained for 30 days, and purged through a restricted routine. |
| [ADR-0008](ADR-0008-platform-settlement-and-legal-entity.md) | Draft | Freezes the no-implementation boundary and required legal/entity, take-rate, settlement, tax, KYC, and dispute decisions before Phase 3. |
| [ADR-0009](ADR-0009-copilot-conversation-cost-retention.md) | Accepted | Separates redacted Copilot turns, per-attempt costs, and product events under a 30-day server-only retention boundary. |

## When to Add an ADR

- Repository, platform, or vendor choice changes.
- A baseline anti-goal is reversed.
- A payment, legal, data-retention, or commercial attribution decision becomes binding.
- A schema or AI pipeline invariant changes.

## Format

Each ADR should include:

- Date
- Status
- Context
- Decision
- Consequences
