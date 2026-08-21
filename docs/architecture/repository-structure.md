# Repository Structure

## Workspace Map

| Path | Owner | Responsibility | Current maturity |
| --- | --- | --- | --- |
| `packages/domain` | Domain | Zod schemas, pure state functions, domain events, seed fixtures | Implemented and tested |
| `packages/ai` | AI runtime | Provider-neutral model router, effort, usage, and cost types | Router skeleton; only static test provider |
| `packages/api-client` | API | Typed tRPC client derived from the server router | Implemented; external server endpoint is not yet deployed |
| `packages/ui` | Design system | Shared semantic tokens, tested CSS projection, and web/native primitive contracts | Implemented token contract; no page components |
| `apps/server` | Backend | Modular tRPC router, services, DB adapters, shared Web composition, two-pass Trip completion, and injected AI route executor | Partially implemented |
| `apps/web` | Traveler Web | Next.js product and public acquisition surfaces | Implemented MVP shell; not production-ready |
| `apps/web-v3` | Traveler Web V3 | Parallel Next.js/Tailwind traveler-facing rewrite and thin future route adapters | Early Access Shell implemented; shared runtime and Vercel Preview pending |
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
- Local Vercel links and pulled secrets remain in `.vercel/`, `.env.local`, or `.env.*.local`; these
  exact paths are ignored while `.env.example` remains trackable.
- Turbo task output globs MUST describe only artifacts that the task really writes. A verification-only
  task such as the mobile TypeScript build declares `outputs: []` and relies on cached logs; it must
  not claim a generated `dist` directory.
- A module exports its supported interface from its index or declared package export. Consumers must
  not depend on internal file layout without an explicit export.
- Both Web apps consume runtime composition only through the
  `@visepanda/app-server/web-composition` package subpath and keep thin local framework adapters.
- Workspace type checking follows the upstream build graph so a clean CI checkout resolves declared
  workspace package exports before a dependent package is typechecked.
- `apps/web`, `apps/web-v3`, and `apps/ops` declare `@visepanda/ui` as a workspace dependency and
  consume its public token exports; they must not import package internals or duplicate core design
  values. Web V3 imports the tested CSS projection and maps it into Tailwind v4 semantic utilities.
- Tailwind CSS v4, its PostCSS plugin, and PostCSS are owned only by `apps/web-v3` in this migration
  stage. The legacy `apps/web` dependency and CSS line remain unchanged as the production rollback.
- Workspace `typecheck` tasks build direct workspace dependencies first, so public declarations are
  available in a clean CI checkout rather than only in a developer's cached `dist` directory.
- Tests live beside the behavior they protect unless a database or end-to-end runner requires a
  dedicated directory.
- Database changes are new migration files. Existing landed migrations are immutable.
- Long-form rationale belongs in docs; concise operational commands belong in runbooks; repeated
  coding-agent rules belong in `AGENTS.md` with links to details.

## Current Known Gaps

The structure is ahead of production readiness. The following distinctions must remain visible:

- A schema or service interface may exist while its durable adapter is incomplete.
- A static provider or in-memory store is a test/demo adapter, not production evidence.
- The Server may depend on `packages/ai` for provider-neutral route execution, but only an explicit
  composition root may wire it into a deployed Copilot request path.
- A merged UI is not proof that authentication, payment, partner approval, or operational SLA exists.
- The Mobile package is a controlled pre-production shell. It remains outside public capability claims
  until the relevant Phase 1 triggers and live dependency evidence are recorded.

Module documents state these gaps explicitly and must be updated when they close.
