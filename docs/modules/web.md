# Web Module

Path: `apps/web`

## Responsibility

The public Next.js application owns acquisition and traveler-facing Phase 0 experiences. It renders
the Copilot workspace, Trip Canvas, Explore, guides, POI pages, Human Help, public Trip shares, and
the outbound gateway.

## Routes

| Route                   | Purpose                                                     |
| ----------------------- | ----------------------------------------------------------- |
| `/`                     | Copilot workspace and Trip Canvas                           |
| `/explore`              | Execution-fact discovery                                    |
| `/guides/[slug]`        | Editorial execution guides                                  |
| `/[city]/[poi]`         | Programmatic POI page                                       |
| `/human-help`           | Human Task request surface                                  |
| `/account`              | Server-verified traveler session and email/password sign-in |
| `/share/trips/[token]`  | Public read-only Trip share                                 |
| `/outbound`             | Validated partner redirect gateway                          |
| `/api/copilot`          | First-pass Copilot request                                  |
| `/api/copilot/complete` | Silent second-pass completion                               |
| `/api/auth/login`       | Supabase email/password sign-in and SSR cookie issuance     |
| `/api/auth/logout`      | Supabase sign-out and SSR cookie clearing                   |
| `/api/auth/session`     | Verified display-safe session status and cookie refresh     |
| `/api/trips/*`          | Trip read, claim, and share handlers                        |

## Data Access

The Next.js API layer creates an in-process server caller through one composition root. Explicit
`preview`, `staging`, and `production` modes require `DATABASE_URL` and select only the existing
Postgres Trip, Knowledge, and Agent Trace adapters. Missing/invalid mode or database configuration returns typed
503 `RUNTIME_UNAVAILABLE`; it never selects memory. Tests inject services explicitly. Only explicit
`local-demo` may use a process-cached, non-durable memory pair. The selected durable service pair is
also process-cached so requests reuse the Postgres pool; persistence remains in Postgres across cold
starts.

[ADR-0005](../adr/ADR-0005-runtime-modes-and-production-adapter-ownership.md) requires explicit mode
selection: only `local-demo` may use labelled fixtures/memory; deployed modes return honest
unavailable states when a required durable dependency is absent. OA-004/OA-005 remain unverified, so
no live durable Vercel claim is made.

For DEMO-01, that composition root injects the v3 real-model Copilot dependencies only in a deployed
runtime. Explicit `test` and `local-demo` retain their deterministic fixtures. A deployed route with
missing model configuration returns 503 `MODEL_CONFIGURATION_UNAVAILABLE`; it never falls back to
fixture text. The API route returns only a dialogue envelope for DEMO-01: Trip mutation, commerce,
Human Help, tool cards, and citations are intentionally absent until their separately governed work
is complete.

Trip and Copilot routes resolve a server-issued anonymous session cookie or verified Supabase SSR
identity under [ADR-0004](../adr/ADR-0004-identity-trip-ownership-security.md). The browser stores only
the last Trip id as a convenience; it does not store or submit owner identity or an authoritative
`currentTrip` snapshot.

P0-03 resolves identity at the Copilot API boundary and ignores body-provided owner fields there. It
also implements the Supabase SSR login/logout/session routes and a signed, server-expiring anonymous
cookie with one-key rotation. The adapter is implemented and unit-tested; real external Auth evidence
remains blocked on OA-001 through OA-003 in the
[operator action register](../governance/operator-action-register.md). Trip read/claim/share
authorization is implemented by P0-04. Existing writes carry `expectedVersion`; stale writes return
409 and leave the current Canvas unchanged. Claim uses the verified account together with the current
signed anonymous cookie, and owner-created public shares can be revoked. Real Supabase release evidence
still depends on OA-001 through OA-003.

Human Help and outbound fixture ledgers remain for explicit test/local-demo only. Deployed requests
return 503 `CAPABILITY_UNAVAILABLE` until P0-13 and P0-18 implement their durable owners.

Copilot writes a best-effort private Agent Trace after a validated result or failure. A trace write
failure cannot alter the public response or Trip state. Trace records follow
[ADR-0007](../adr/ADR-0007-agent-trace-privacy-retention.md) and never contain raw prompts, envelope
payloads, cookies, credentials, or narrative errors.

## UI Rules

- The first screen is the usable Copilot workspace, not a marketing-only hero.
- The canonical visual source is the Red Gold Design System.
- Unknown, offline, demo, and failed states must be explicit.
- A disabled or unavailable action is hidden or clearly disabled; inert controls are not allowed.
- Commercial actions show disclosure and use `/outbound`.
- Responsive behavior is verified at 375, 768, 1280, and 1440 pixel widths.

## Verification

```bash
pnpm --filter @visepanda/app-web typecheck
pnpm --filter @visepanda/app-web test
pnpm --filter @visepanda/app-web build
```

UI changes require desktop and mobile browser evidence. Route or metadata changes require a link and
indexing check.
