# Change Classification and Documentation Sync Map

Status: active

Classify before editing. Choose the highest class that applies.

| Class | Example | Required design action | Required documentation |
| --- | --- | --- | --- |
| C0 Editorial | typo with no semantic effect | none | edited document only |
| C1 Local | one module behavior, interface unchanged | D1 Issue | module doc + tests |
| C2 Contract | schema/API/event/migration/state transition | interface baseline review | domain/API/data docs; ADR if direction changes |
| C3 System | subsystem boundary, permissions, deployable, payment route | D2 overall-design review | architecture + constraints + ADR + runbook |
| C4 Product | positioning, commercial model, phase trigger, anti-goal | D3 operator decision | frozen baseline amendment/superseding ADR + roadmap |

## Source-to-Document Map

| Source area | Primary explanation | Constraints/runbooks commonly required |
| --- | --- | --- |
| `packages/domain/` | `docs/modules/domain.md` | architecture, API, testing |
| `packages/ai/` | `docs/modules/ai.md` | business/deployment + eval runbook |
| `packages/api-client/` | `docs/modules/api-client.md` | API contracts |
| `packages/ui/` | `docs/modules/ui.md` | design system |
| `apps/server/` | `docs/modules/server.md` | API, permissions, data/runbooks |
| `apps/web/` | `docs/modules/web.md` | design, business, deployment |
| `apps/ops/` | `docs/modules/ops.md` | permissions + relevant Ops runbook |
| `apps/mobile/` | `docs/modules/mobile.md` | design, deployment, permissions |
| `infra/supabase/` | `docs/modules/data-platform.md` | permissions + Supabase runbook |
| `evals/` | `evals/README.md` | AI eval runbook |
| `.github/`, root build config | repository structure | deployment/governance |

The manifest contains the executable prefix mapping. This table explains intent and must remain
aligned with it.

## Deviation Mapping

- C0 normally records no deviation.
- C1 is normally D1.
- C2 is at least D2 when existing consumers can change behavior.
- C3 is D2.
- C4 is D3.

The mappings are minimums, not automatic downgrades. A local file change can still expose a D3
product assumption.
