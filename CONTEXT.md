# VisePanda Context

This file is the shared language source for humans and coding agents. It defines the terms used in
code, Issues, ADRs, runbooks, product copy, and operational discussion. Detailed rules live in the
[documentation index](docs/INDEX.md).

## Product Thesis

VisePanda is the execution copilot for foreigners travelling in China. Planning attracts users;
reliable execution, paid human help, and qualified partner referrals create value and revenue.
VisePanda is not an OTA, a generic itinerary generator, or a collection of unrelated travel tools.

## Canonical Terms

| Term | Meaning | Avoid |
| --- | --- | --- |
| Copilot | The single user-facing AI interaction surface | Butler, chatbot, bot |
| Copilot envelope | Typed response containing a message and optional actions, citations, tools, or handoff | Raw model response |
| Trip | The current materialized travel plan | Itinerary blob |
| TripPatch | A typed, validated request to change a Trip | Direct Trip mutation |
| Trip event | Append-only record of an applied TripPatch | Edit history row |
| Execution fact | Source-backed, confidence-scored, time-bounded China travel fact | Tip, AI fact |
| Knowledge gap | Repeated user question that lacks sufficient verified evidence | Failed prompt |
| Human Task | Paid or quoted real-world assistance requiring a person | Customer-service chat |
| Partner | Approved commercial or creator relationship with explicit status and tracking rules | Vendor by implication |
| Outbound click | Auditable redirect through the VisePanda gateway | Raw affiliate link |
| Entitlement | A time-bounded or purchase-backed product right | Subscription flag |
| Module | A business boundary inside the modular monolith | Microservice |
| Service | An explicit module interface used by routers or other modules | Global helper |
| Adapter | Replaceable persistence or provider implementation behind a service | Fallback truth source |
| Surface | Web, Ops, Mobile, or another user-facing application | Client when ambiguous |
| Issue | One independently reviewable unit of work in GitHub Issues | Ticket, backlog item |
| ADR | Append-only record of a binding architecture or business decision | Planning note |
| Constraint | A mandatory, testable rule; `MUST`, `MUST NOT`, and `REQUIRED` are normative | Preference |
| JTCoding Skills | The permanent VisePanda engineering workflow; the current single entrypoint covering the former Qian systems-engineering, documentation-as-code, and focused coding disciplines | A motivational slogan or three separate skills |
| Overall design baseline | The current operational translation of product goals into subsystems, interfaces, control measures, and gates | A second product roadmap |
| Control objective | A desired, measurable product or engineering outcome with an owner and review cadence | General ambition |
| Observation | Evidence collected from tests, telemetry, operations, users, or reviews | Opinion without evidence |
| Deviation | A measured difference between an accepted objective or interface and observed behavior | Any implementation detail |
| Control action | An Issue, rollback, flag change, runbook action, or ADR created to reduce an accepted deviation | Untracked chat instruction |
| Interface baseline | A reviewed domain, API, event, migration, or module contract whose consumers may rely on it | Internal function signature |
| Lifecycle gate | A named evidence checkpoint that work must pass before moving to the next stage | Informal approval |
| Meta-synthesis | Human judgment, domain evidence, software checks, and AI analysis combined iteratively into a reviewable decision | Asking several models and taking a vote |

## Relationships

- A user message enters Copilot and produces one validated Copilot envelope.
- A Copilot envelope may contain TripPatch values; deterministic application creates Trip events.
- Execution facts feed Explore, Copilot retrieval, and search pages.
- Unanswered questions create knowledge gaps; reviewed gaps may become execution facts.
- Commercial actions reference active partners and create outbound clicks through the gateway.
- Human Tasks have an explicit state machine and must produce payment and telemetry evidence when
  money moves.
- Domain schemas are owned by `packages/domain`; applications consume them rather than redefining
  them.
- GitHub Issues define work; ADRs define decisions; constraints define rules; runbooks define
  operational procedures.
- The [overall design baseline](docs/architecture/top-level-design.md) translates the frozen product
  baseline into controlled subsystems, interfaces, measures, and lifecycle gates.
- [JTCoding Skills](docs/methodology/qian-systems-engineering.md) governs how observations become
  deviations, Issues, verified control actions, and archived knowledge.

## Truth Hierarchy

When documents disagree, use this order:

1. Accepted ADRs and active constraint documents.
2. Executable domain schemas, migrations, tests, and CI configuration.
3. Active architecture and module documentation.
4. The frozen product baseline.
5. Dated reviews, research, design explorations, and historical planning.

An inconsistency is a defect. Fix the code or the higher-authority document in the same PR.

## Current Architecture Name

`Fable-5 architecture` means the accepted VisePanda V2 baseline: TypeScript monorepo, modular
monolith, schema-first domain package, event-sourced Trip changes, Web-first delivery, and a
knowledge flywheel. It is a project architecture label, not a third-party runtime or framework.
