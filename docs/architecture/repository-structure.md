# Repository Structure

## Workspace Map

| Path | Owner | Responsibility | Current maturity |
| --- | --- | --- | --- |
| `packages/domain` | Domain | Zod schemas, pure state functions, domain events, seed fixtures | Implemented and tested |
| `packages/ai` | AI runtime | Provider-neutral model router, effort, usage, and cost types | Router skeleton; only static test provider |
| `packages/api-client` | API | Typed tRPC client derived from the server router | Implemented; external server endpoint is not yet deployed |
| `packages/ui` | Design system | Shared tokens and web/native primitive contracts | Placeholder |
| `apps/server` | Backend | Modular tRPC router, services, DB adapters, two-pass Trip completion | Partially implemented |
| `apps/web` | Traveler Web | Next.js product and public acquisition surfaces | Implemented MVP shell; not production-ready |
| `apps/ops` | Operations | Fact, gap, and Human Task workflows | Implemented shell; auth and persistence incomplete |
| `apps/mobile` | Mobile | Future Expo execute-stage application | Placeholder by roadmap decision |
| `infra/supabase` | Data platform | Local config and append-only Postgres migrations | Schema exists; security and deployment validation continue |
| `evals` | AI quality | Golden fixtures and deterministic evaluation runner | Initial Trip generation suite implemented |
| `docs` | Engineering | Architecture, modules, constraints, decisions, runbooks, design, planning | Governed by manifest and CI |

## Source of Truth by Concern

| Concern | Canonical source |
| --- | --- |
| Product terminology | `CONTEXT.md` |
| Domain fields and enums | `packages/domain` Zod schemas |
| Database shape | Ordered files in `infra/supabase/migrations` |
| Public server operations | `apps/server/src/router.ts` and exported module routers |
| Design direction | `docs/design-system/visepanda-v2-red-gold-design-system.md` |
| Binding decisions | Accepted ADRs |
| Mandatory engineering behavior | `docs/constraints` |
| Current implementation explanation | `docs/architecture` and `docs/modules` |
| Live work state | GitHub Issues and PRs |
| Historical plan or review | Dated files under `docs/planning` |

## Directory Rules

- Generated output (`dist`, `.next`, `.turbo`) is never a source of truth and must not be committed.
- A module exports its supported interface from its index or declared package export. Consumers must
  not depend on internal file layout without an explicit export.
- Tests live beside the behavior they protect unless a database or end-to-end runner requires a
  dedicated directory.
- Database changes are new migration files. Existing landed migrations are immutable.
- Long-form rationale belongs in docs; concise operational commands belong in runbooks; repeated
  coding-agent rules belong in `AGENTS.md` with links to details.

## Current Known Gaps

The structure is ahead of production readiness. The following distinctions must remain visible:

- A schema or service interface may exist while its durable adapter is incomplete.
- A static provider or in-memory store is a test/demo adapter, not production evidence.
- A merged UI is not proof that authentication, payment, partner approval, or operational SLA exists.
- The Mobile package is intentionally a compilation placeholder until Phase 1 triggers are met.

Module documents state these gaps explicitly and must be updated when they close.
