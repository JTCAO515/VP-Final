# ADR Index

Architecture Decision Records capture decisions that should not be re-litigated in ordinary PRs.
New ADRs are append-only and use the next numeric prefix.

| ADR                                                                    | Status   | Decision                                                                                                                                   |
| ---------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| [ADR-0001](ADR-0001-repo-and-v1-disposition.md)                        | Accepted | V2 lives in the standalone `JTCAO515/VP-Final` repository; V1 is a separate wind-down line.                                                |
| [ADR-0002](ADR-0002-documentation-as-code.md)                          | Accepted | Documentation is registered, generated, impact-mapped, and checked as code.                                                                |
| [ADR-0003](ADR-0003-qian-systems-engineering-workflow.md)              | Accepted | 钱学森 Skills is the permanent closed-loop engineering workflow.                                                                           |
| [ADR-0004](ADR-0004-identity-trip-ownership-security.md)               | Accepted | Server-verified identity, exclusive Trip ownership, read-only sharing, and optimistic concurrency are mandatory before public persistence. |
| [ADR-0005](ADR-0005-runtime-modes-and-production-adapter-ownership.md) | Accepted | Explicit runtime modes, single durable production ownership, and fail-closed truthfulness are mandatory before public persistence.         |
| [ADR-0006](ADR-0006-knowledge-evidence-and-index-quality.md)           | Accepted | Only reviewed/current evidence may power public facts, Copilot citations, or indexable guidance.                                           |
| [ADR-0007](ADR-0007-agent-trace-privacy-retention.md)                  | Accepted | Server-only AI trace metadata is minimized, redacted, retained for 30 days, and purged through a restricted routine.                       |
| [ADR-0008](ADR-0008-platform-settlement-and-legal-entity.md)           | Draft    | Freezes the no-implementation boundary and required legal/entity, take-rate, settlement, tax, KYC, and dispute decisions before Phase 3.   |
| [ADR-0009](ADR-0009-copilot-conversation-cost-retention.md)            | Accepted | Separates redacted Copilot turns, per-attempt costs, and product events under explicit server-only retention boundaries.                   |
| [ADR-0010](ADR-0010-copilot-cost-accounting-contract.md)               | Accepted | Freezes cache-aware provider pricing, deterministic cost calculation, and independent cost-ledger lifecycle.                               |
| [ADR-0011](ADR-0011-retention-purge-scheduling.md)                     | Accepted | Uses database-local scheduled retention purges with bounded health evidence.                                                               |
| [ADR-0012](ADR-0012-phase0-telemetry-observation-contract.md)          | Accepted | Freezes privacy-safe Phase 0 telemetry capture, registered actions, and private aggregate views.                                           |
| [ADR-0013](ADR-0013-human-task-transition-telemetry-staging.md)        | Accepted | Human Task lifecycle analysis derives from `human_tasks`; Phase 0 telemetry records intake context, not duplicate transitions.             |
| [ADR-0014](ADR-0014-vise-pod-https-turn-transport.md)                  | Accepted | VisePod v1 uses one signed HTTPS request per Wi-Fi push-to-talk turn rather than a persistent WebSocket transport.                         |
| [ADR-0015](ADR-0015-public-runtime-safety-control.md)                  | Accepted | Freezes the bounded, truthful public-runtime control plane for P0-20 without duplicating existing owners.                                  |
| [ADR-0016](ADR-0016-execution-fact-safety.md)                          | Accepted | Freezes that execution facts need current eligible evidence and high-risk expressions use verified fixed wording or an honest fallback.    |
| [ADR-0017](ADR-0017-vise-pod-studio-provisioning.md)                   | Accepted | Uses scoped, online-validated Ops provisioning for server-side VisePod user/device bindings and rejects user browsing.                     |
| [ADR-0018](ADR-0018-voice-call-cost-accounting.md)                     | Accepted | Extends the retained cost ledger for token, audio-second, and character calls without activating voice providers.                          |
| [ADR-0019](ADR-0019-mobile-telemetry-observation.md)                   | Accepted | Freezes authenticated, closed-set mobile observations with a bounded local retry queue and server-owned privacy controls.                  |
| [ADR-0020](ADR-0020-creator-attribution-contract.md)                   | Accepted | Freezes creator referrals as private server-resolved acquisition sources and keeps them separate from OTA outbound links.                  |
| [ADR-0021](ADR-0021-ops-poi-image-storage.md)                          | Accepted | Freezes private, server-mediated, attributed Ops image storage; it does not authorize public image delivery.                               |

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
