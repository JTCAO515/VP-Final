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
Postgres Trip, Knowledge, Agent Trace, and Human Task adapters. Missing/invalid mode or database configuration returns typed
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

When configured model routes all fail, the route keeps the same public 503 contract and emits only a
sanitized runtime diagnostic: route/provider id, configured model id, failure class, and latency. It
never logs a prompt, provider response body, credential, cookie, or raw error payload. This is the
minimum evidence needed to diagnose the real-provider gate without widening public error details.

DEMO-01b keeps the Web surface deliberately narrow: it renders only the validated assistant
headline/body/highlights envelope, a static read-only preview of up to three returned Trip days,
and visible waiting, failure, and retry states. The preview contains no editing or action control;
it is evidence of the response shape rather than a Trip Canvas. The previous fixture Trip Canvas,
booking/share controls, Human Help CTA, commercial actions, tool cards, and citations are absent
from this surface until their owning Phase 0 Issues are accepted.

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

Human Help now writes through the durable P0-13 adapter. `/api/human-help` derives owner identity from
the verified session or signed anonymous cookie, requires an idempotency key, and returns only the
task id, `requested` status, and creation time. It never echoes contact or description and never
returns a quote or payment claim. The public page states the Shanghai/English/capacity and safety
limits; database or runtime failure returns an honest error and no receipt. Outbound remains unavailable
until P0-18 implements its durable owner.

P0-14 adds the Human Task lifecycle contract behind that intake path, but does not change the public
receipt or expose a public status mutation. Web test fixtures inject the complete service interface so
an unavailable durable adapter still returns the existing honest intake failure rather than fabricating
a transition or payment state.

Copilot writes a best-effort private Agent Trace after a validated result or failure. A trace write
failure cannot alter the public response or Trip state. Trace records follow
[ADR-0007](../adr/ADR-0007-agent-trace-privacy-retention.md) and never contain raw prompts, envelope
payloads, cookies, credentials, or narrative errors.

## UI Rules

- The home page opens with a product-first Copilot introduction: a single clear promise and a
  read-only product preview establish the task before the usable Copilot workspace immediately
  below it. It is not a marketing-only hero.
- Home-page capability content is grouped by traveler scenario (before flying, on the move, and
  when plans change). Ecosystem surfaces appear in a separate section so one viewport has one
  primary job.
- The home product preview is illustrative only. It must not claim that bookings, payments, or
  Human Help have occurred, and it must not introduce inert controls.
- The canonical visual source is the Red Gold Design System.
- Public product routes share one navigation and footer rhythm. Floating navigation may use a
  translucent material, but content hierarchy and legibility take priority over decoration.
- Interactive controls provide immediate press feedback and preserve a 44-pixel minimum target.
  Reduced-motion, reduced-transparency, and increased-contrast preferences must retain a complete,
  understandable experience.
- Unknown, offline, demo, and failed states must be explicit.
- A disabled or unavailable action is hidden or clearly disabled; inert controls are not allowed.
- Commercial actions show disclosure and use `/outbound`.
- Responsive behavior is verified at 375, 768, 1280, and 1440 pixel widths.
- At narrow widths, primary navigation uses four equal tracks and prompt cards wrap their text; no
  Copilot element may force horizontal page scrolling.

Explore reads POIs through the runtime-owned KnowledgeService. Deployed modes therefore use the
durable Postgres adapter, while only explicit `local-demo` may render the labelled seed dataset.
Cards show short labels only for current reviewed `payment_acceptance`, `metro_access`,
`booking_required`/`reservation_helpful`, `crowd_pattern`, and `rainy_fit` facts. Unknown, expired,
unreviewed, deprecated, or unlabeled facts stay hidden; load failure produces an honest unavailable
state rather than fixture content. Explore tests construct facts through the authoritative domain
schema and include the evidence metadata required by the reviewed-fact eligibility boundary.

## Verification

```bash
pnpm --filter @visepanda/app-web typecheck
pnpm --filter @visepanda/app-web test
pnpm --filter @visepanda/app-web build
```

UI changes require desktop and mobile browser evidence. Route or metadata changes require a link and
indexing check.
