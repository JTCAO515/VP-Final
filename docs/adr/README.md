# ADR Index

Architecture Decision Records capture decisions that should not be re-litigated in ordinary PRs.
New ADRs are append-only and use the next numeric prefix.

| ADR | Status | Decision |
|---|---|---|
| [ADR-0001](ADR-0001-repo-and-v1-disposition.md) | Accepted | V2 lives in the standalone `JTCAO515/VP-Final` repository; V1 is a separate wind-down line. |
| [ADR-0002](ADR-0002-documentation-as-code.md) | Accepted | Documentation is registered, generated, impact-mapped, and checked as code. |
| [ADR-0003](ADR-0003-qian-systems-engineering-workflow.md) | Accepted | 钱学森 Skills is the permanent closed-loop engineering workflow. |

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
