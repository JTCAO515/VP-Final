# Web Module

Path: `apps/web`

## Responsibility

The public Next.js application owns acquisition and traveler-facing Phase 0 experiences. It renders
the product home, VisePanda workspace and Trip Canvas, Explore, guides, POI pages, Human Help, public Trip shares, and
the outbound gateway.

## Routes

| Route                            | Purpose                                                                        |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `/`                              | Product home with an illustrative, non-interactive VisePanda workspace preview |
| `/visepanda`                     | Canonical VisePanda workspace and Trip Canvas                                  |
| `/copilot`                       | Legacy redirect to `/visepanda`                                                |
| `/readiness`                     | Explainable, fixed-answer China preparation self-check                         |
| `/explore`                       | Execution-fact discovery                                                       |
| `/guides/[slug]`                 | Editorial execution guides                                                     |
| `/[city]/[poi]`                  | Programmatic POI page                                                          |
| `/human-help`                    | Human Task request surface                                                     |
| `/account`                       | Server-verified traveler session and email/password registration/sign-in       |
| `/privacy`                       | Public Privacy Policy                                                          |
| `/terms`                         | Public Terms of Use                                                            |
| `/affiliate-disclosure`          | Public affiliate relationship disclosure                                       |
| `/human-help-disclaimer`         | Full Human Help controlled-preview limits                                      |
| `/emergency-disclaimer`          | Official emergency-channel guidance and product limits                         |
| `/share/trips/[token]`           | Public read-only Trip share                                                    |
| `/outbound`                      | Validated partner redirect gateway                                             |
| `/api/copilot`                   | First-pass Copilot request                                                     |
| `/api/copilot/complete`          | Silent second-pass completion                                                  |
| `/api/copilot/complete/callback` | Signed QStash completion delivery callback                                     |
| `/api/auth/login`                | Supabase email/password sign-in and SSR cookie issuance                        |
| `/api/auth/logout`               | Supabase sign-out and SSR cookie clearing                                      |
| `/api/auth/session`              | Verified display-safe session status and cookie refresh                        |
| `/api/telemetry`                 | Strict privacy-safe browser telemetry capture                                  |
| `/api/mobile/trips`              | Verified mobile-session read-only Trip list                                    |
| `/api/trips/*`                   | Trip read, claim, and share handlers                                           |

## Data Access

The Next.js API layer creates an in-process server caller through one composition root. Explicit
`preview`, `staging`, and `production` modes require `DATABASE_URL` and select only the existing
Postgres Trip, Knowledge, Agent Trace, Human Task, Commerce, and Readiness adapters. Missing/invalid
mode or database configuration returns typed 503 `RUNTIME_UNAVAILABLE`; it never selects memory. Tests inject services explicitly. Only explicit
`local-demo` may use a process-cached, non-durable memory pair. The selected durable service pair is
also process-cached so requests reuse the Postgres pool; persistence remains in Postgres across cold
starts.

The composition root also supplies the private Readiness service to the shared server router. It is
not a browser table-access path: a later traveler UI uses only server procedures, explicit persistence
consent, and the existing verified-account or signed-anonymous-Trip identity boundary. Deployed
retention defaults to 180 days and `VISEPANDA_READINESS_RETENTION_DAYS` may only shorten it; invalid
configuration fails composition rather than silently retaining data longer.

`/readiness` is the traveler-facing consumer of that fixed contract. It is an explainable self-check,
not a percentage score, recommendation engine, booking surface, or externally verified record. It
renders all ten versioned questions and their rule ids, observed answer, evidence status, and next
action; unanswered inputs remain explicit `unknown`. Its browser route accepts only the domain's
fixed enum payload, resolves ownership server-side, and requires a separate opt-in before persistence.
No partner CTA is rendered by this core flow, and no free-form text, passport data, or travel narrative
is submitted through it.

[ADR-0005](../adr/ADR-0005-runtime-modes-and-production-adapter-ownership.md) requires explicit mode
selection: only `local-demo` may use labelled fixtures/memory; deployed modes return honest
unavailable states when a required durable dependency is absent. OA-004/OA-005 remain unverified, so
no live durable Vercel claim is made.

The `/outbound` route resolves identity only from a verified Supabase session or the server-signed
anonymous cookie; query parameters cannot supply ownership. It delegates partner lookup, URL
validation, and click persistence to the server Commerce service. Only a current `active` database
partner with an exact allowlisted HTTPS host can redirect, and the click row must commit first.
Pending, inactive, unknown, malformed, or unrecordable actions return an honest non-redirect
response. A newly issued anonymous cookie is preserved on both success and failure. No partner is
active by repository default, and partner management remains an authorized Ops follow-up.

`GET /api/mobile/trips` is a narrow native-app boundary. It accepts only a syntactically bounded
Bearer token, validates that token online through Supabase Auth, derives the authenticated owner
server-side, and returns the domain-owned `MobileTripListResponseSchema`. It never accepts an owner
header, shares a browser cookie, exposes Trip events, or permits a write. Missing Supabase public
configuration and durable Trip failures return a generic 503; an absent or invalid mobile session
returns 401. The endpoint never logs access tokens.

Explore renders a commercial CTA only when the durable Knowledge service returns an active
`poi_commercial_links` row. The CTA contains that row's disclosure and routes to same-origin
`/outbound` with bounded `explore` attribution; it never exposes a raw partner destination as the
link target. An absent, pending, inactive, or unavailable link renders nothing.

`POST /api/telemetry` is a deliberately narrow, best-effort observation endpoint. Its request body
accepts only client-safe Explore and Human Help pre-submit actions with bounded dimensions; it rejects
client-supplied identity, id, timestamp, expiry, commercial attribution, and unrestricted payloads.
The composition root supplies the durable telemetry service, which derives one trusted identity and
the remaining persistence metadata. A successful capture returns no stored event content. A rejected
or unavailable capture is honest and does not change the user's primary product operation. Explore
and guide views use this bounded client path for `poi_viewed`, `scene_filter_used`, and `guide_viewed`;
Human Help records `human_help_viewed` and the first form focus as `task_started`. These browser
captures are best effort and do not include form text. Server lifecycle producers are scheduled after
the associated authoritative Copilot result, outbound click-ledger commit, or Human Task creation;
they cannot delay the answer, redirect, or task receipt. `partner_redirected` means that VisePanda
issued a durable approved redirect, not that a partner accepted a booking or conversion.

The Rescue consumer may similarly emit only `rescue_started` and `rescue_route_selected` through the
strict browser endpoint. They carry a fixed Rescue category and deterministic primary-action kind,
not an incident narrative, location, contact, health detail, or free-form outcome. Availability,
Human Help offer/confirmation, and resolution lifecycle events remain server-owned and must not be
emitted merely because a disabled or unavailable Rescue route rendered.

`/rescue` obtains a server-only runtime configuration before rendering its fixed-category chooser.
Reviewed self-service actions are exposed only when their exact route id is explicitly configured and
has a first-party destination; unknown ids never turn into a link. Human Help is available only when
all bounded scope fields are configured and the current `Asia/Shanghai` hour falls within the
configured window. Otherwise the domain receives `unavailable`, so the public surface does not offer
a task, price, payment, response-time, or service promise. The client carries no Trip, block,
location, or incident narrative into the optional Human Help handoff; it may only preselect an
editable task kind.

Arrival Pack browser observations are likewise closed-set: generated, downloaded, and regenerated may
send only fixed version/count metadata. They never send the printable Trip text, local address, Readiness
answers, rendered HTML, or any download payload. `arrival_pack_downloaded` means that the browser was
asked to initiate a download; it does not prove a file reached disk or cloud storage, and a failed local
download does not produce a success event.

`/arrival-pack` is a browser-local, explicitly generated projection of the current Trip. It reads the
owner-scoped Trip and any consented Readiness self-report, then uses the domain `ArrivalPack` projection
to exclude raw conversation, notes, raw block addresses, passport, payment, and credential content. The
page offers offline HTML and the browser's own print/save-as-PDF workflow only; it does not create a
storage URL or imply that a file has been durably saved. Chinese address text may render only when the
projection carries a current reviewed fact receipt. Until a Trip-to-fact binding exists, the consumer
states that no reviewed Chinese address is included rather than inferring one from the Trip.

Public POI/intent SEO pages at `/[city]/[poi]/[intent]` load POIs from the current knowledge service on
each request and resolve the shared domain SEO matrix before rendering. An unsupported, expired, or
incomplete candidate is a 404, not a conservative-looking fallback. The page publishes only the fact
receipts named by its candidate, the public-safe source label, verification date, canonical path, and a
minimal `Place` JSON-LD record without a legacy address. Only after that candidate resolves may the
composition root read a private SEO editorial override and replace its bounded title, summary, or
optional editor note. Missing or deleted override rows leave generated copy intact; an override cannot
make a route exist, extend candidate freshness, alter facts, or affect the JSON-LD evidence boundary.
Sitemap and noindex aggregation remain the separate #86 consumer of this same authority.

`/sitemap.xml` loads the same current matrix and includes only its canonical POI/intent candidates,
alongside the fixed public home, Explore, and guide pages. The legacy two-segment POI page is excluded
from the sitemap and explicitly `noindex`; it may remain an application navigation surface but is not
an evidence-backed SEO authority. `robots.txt` blocks account, workspace, readiness, Arrival Pack,
Human Help, share, outbound, and API paths. The checked-in fixture runs a duplicate-canonical-path
build guard, while runtime matrix validation keeps durable knowledge changes from silently producing
duplicate public SEO URLs. Private Trip shares also carry response metadata `noindex` regardless of
token validity.

Before the endpoint delegates to the telemetry service, it requires both the verified signed-session
or account identity and Vercel's trusted client address to pass independent Upstash sliding windows.
The current default allows a generous real browsing burst: `60/minute` and `300/hour` per identity,
then `180/minute` and `900/hour` for a shared network. This covers the current three guide mounts,
five Explore scene choices, POI opens, and two Human Help pre-submit observations without treating
normal browsing as abuse. The route rejects excess requests with HTTP 429 and `Retry-After`, fails
closed with HTTP 503 when the guard cannot establish trusted dependencies, and never lets a rejected
request reach telemetry storage. Its Redis keys and bounded rejection counter use HMAC digests only.

For DEMO-01, that composition root injects the v3 real-model Copilot dependencies only in a deployed
runtime. Explicit `test` and `local-demo` retain their deterministic fixtures. A deployed route with
missing model configuration returns 503 `MODEL_CONFIGURATION_UNAVAILABLE`; it never falls back to
fixture text. The API route returns only a dialogue envelope for DEMO-01: Trip mutation, commerce,
Human Help, tool cards, and citations are intentionally absent until their separately governed work
is complete.

When durable Web services are composed, an incomplete DEMO-01 provider route emits one private
`copilot_provider_configuration_degraded` warning containing only route/provider, model-variable name,
key-variable name, and missing class. It never includes an environment value or creates a public
provider-health response; the affected capability continues to return its typed unavailable result.

The durable composition also injects the server-only, exact-key Safe Phrase resolver for ADR-0016.
The browser route does not accept phrase-selection keys, so public high-risk chat input cannot choose
or enumerate editorial expressions. A later controlled surface may pass an exact server-validated
selection; otherwise the Copilot pipeline returns the fixed unavailable response instead of model text.

When configured model routes all fail, the route keeps the same public 503 contract and emits only a
sanitized runtime diagnostic: route/provider id, configured model id, failure class, and latency. It
never logs a prompt, provider response body, credential, cookie, or raw error payload. This is the
minimum evidence needed to diagnose the real-provider gate without widening public error details.

Unexpected Copilot persistence, driver, or internal runtime failures return the stable public 502
`COPILOT_REQUEST_FAILED` contract with generic retry guidance. Raw exception messages, SQL, relation
names, connection details, cookies, signatures, prompts, and provider material must never cross the
public response boundary; server diagnostics for this fallback are limited to a fixed failure class.

DEMO-01b keeps the Web surface deliberately narrow: it renders only the validated assistant
headline/body/highlights envelope, a static read-only preview of up to three returned Trip days,
and visible request, failure, and retry states. Request labels describe observed lifecycle state; they
do not claim that a provider is online or that the product is generally ready. The preview contains
no editing or action control; it is evidence of the response shape rather than a Trip Canvas. The
previous fixture Trip Canvas, booking/share controls, Human Help CTA, commercial actions, tool cards,
and citations are absent from this surface until their owning Phase 0 Issues are accepted.

Trip and Copilot routes resolve a server-issued anonymous session cookie or verified Supabase SSR
identity under [ADR-0004](../adr/ADR-0004-identity-trip-ownership-security.md). The browser stores only
the last Trip id as a convenience; it does not store or submit owner identity or an authoritative
`currentTrip` snapshot.

P0-03 resolves identity at the Copilot API boundary and ignores body-provided owner fields there. It
also implements the Supabase SSR registration/login/logout/session routes and a signed,
server-expiring anonymous cookie with one-key rotation. Registration either establishes a server
session or honestly asks the traveler to confirm the Supabase email before signing in. The adapter is
implemented and unit-tested; real external Auth evidence
remains blocked on OA-001 through OA-003 in the
[operator action register](../governance/operator-action-register.md). Trip read/claim/share
authorization is implemented by P0-04. Existing writes carry `expectedVersion`; stale writes return
409 and leave the current Canvas unchanged. Claim uses the verified account together with the current
signed anonymous cookie, and owner-created public shares can be revoked. Real Supabase release evidence
still depends on OA-001 through OA-003.

P0-20's first demo guard limits a signed anonymous identity to three successfully completed Copilot
turns. The third response carries server-derived usage metadata and the Web surface warns that the
next question requires account access. A fourth attempt returns HTTP 403
`ANONYMOUS_TURN_LIMIT_REACHED`, is not sent to a model, disables further anonymous composition, and
links to the `/account` registration/sign-in form. If concurrent in-flight requests only reserve the
remaining capacity, the API instead returns HTTP 409 `ANONYMOUS_TURN_IN_PROGRESS` and the UI asks the
traveler to retry without claiming the quota is complete. User-facing quota copy derives the
configured limit from the domain-validated response. Missing Upstash configuration returns HTTP 503
`ANONYMOUS_TURN_CONTROL_UNAVAILABLE`; no browser value can raise or reset the server count. Verified
authenticated users bypass this anonymous-only wall.

Before the network guard, model composition, or anonymous-turn reservation, the Copilot route applies
the accepted server-owned input ceiling. It returns HTTP 413 `COPILOT_INPUT_TOO_LARGE` with the active
code-unit maximum when a valid message exceeds the default 8,000 or a stricter deployment setting.
Invalid safety-policy configuration returns the typed honest 503 unavailable response instead of
silently ignoring the configured boundary.

The separate network guard applies to both anonymous and authenticated Copilot requests before the
model pipeline. On Vercel it reads only the first valid `x-vercel-forwarded-for` address and ignores
client-controlled `x-forwarded-for`. Exceeding either configured sliding window returns HTTP 429
`COPILOT_IP_RATE_LIMITED` with `Retry-After`; the workspace shows the server's wait message with zero
model attempts. Missing trusted platform/header, salt, Redis configuration, or Redis availability
returns HTTP 503 `COPILOT_IP_RATE_LIMIT_UNAVAILABLE`. Tests and explicit `local-demo` use one fixed
local identity; other non-Vercel deployed modes fail closed. OA-013 owns production verification.

After that shared network guard, only a verified authenticated session enters the separate account
window. It uses an Upstash key formed from a domain-separated HMAC of the server-verified user id;
the user id, address, salt, and cookie never enter Redis or public/logged diagnostics. Exhaustion
returns HTTP 429 `COPILOT_AUTHENTICATED_RATE_LIMITED` with `Retry-After`; an absent or failed required
identity limiter returns HTTP 503 `COPILOT_AUTHENTICATED_RATE_LIMIT_UNAVAILABLE` rather than using an
in-process fallback. Anonymous visitors remain governed by their existing signed turn wall and shared
network guard only.

The workspace presents anonymous exhaustion, trusted-network rate limiting, and model-provider
failure through one accessible status-notice pattern while preserving different recovery actions.
Anonymous exhaustion links to account access and disables composition; an HTTP 429 displays the
server-authoritative wait interval without an immediate retry control; model failure states say that
no answer was generated and may offer retry. These messages never imply a booking, fallback answer,
provider-health guarantee, or successful model call.

The App Router error boundary supplies a separate recovery state for an unexpected rendering failure.
It shows no raw error, stack, prompt, cookie, token, credential, provider body, or Trip data: only a
fresh opaque correlation id, a retry action, and a return-to-Copilot link. The Copilot route's generic
unexpected 502 response may include the same kind of safe correlation id for support. Sentry is not
required for either behavior; OA-008 must be explicitly configured before any third-party reporter is
treated as active.

Human Help now writes through the durable P0-13 adapter. `/api/human-help` derives owner identity from
the verified session or signed anonymous cookie, requires an idempotency key, and returns only the
task id, `requested` status, and creation time. It never echoes contact or description and never
returns a quote or payment claim. A verified traveler may create one new request per China day;
replaying the same idempotency key returns the original receipt, while a different same-day request
returns HTTP 429 with an honest try-again-tomorrow notice. Signed-anonymous users remain subject only
to the separate Shanghai preview-wide capacity. The public page states the Shanghai/English/capacity
and safety limits; database or runtime failure returns an honest error and no receipt. Outbound remains
unavailable until P0-18 implements its durable owner.

P0-14 adds the Human Task lifecycle contract behind that intake path, but does not change the public
receipt or expose a public status mutation. Web test fixtures inject the complete service interface so
an unavailable durable adapter still returns the existing honest intake failure rather than fabricating
a transition or payment state. P0-15's task-detail and operator-note methods remain Ops-only: the Web
Human Help route invokes only `create` and cannot read contact details, write internal notes, or perform
lifecycle transitions. P0-16 extends the injected service interface with private evidence methods for
Ops consumers, but the public Web route neither calls those methods nor exposes evidence in its
receipt or failure response.

Copilot writes best-effort private observability after a validated result or failure. Before the
composition root receives the record, the user message and typed envelope are recursively redacted
for email, phone, travel-document, credential, cookie, and signature material. The durable writer
then atomically stores one redacted conversation turn, every immutable model-attempt cost snapshot,
and allowlisted product events with explicit retention deadlines. Anonymous-limit and IP-rate-limit
events use the same injected event service; IP events never contain the trusted or spoofed address.
Any observability failure emits only `persistence_error` and cannot alter the public response or Trip
state. The legacy Agent Trace remains digest/metadata-only under
[ADR-0007](../adr/ADR-0007-agent-trace-privacy-retention.md).
The Copilot route schedules these writes with Next.js `after()` so a validated answer, registration
wall, or rate-limit response does not wait for Postgres. If scheduling itself is unavailable, the
same safe best-effort write starts without awaiting it and retains the fixed sanitized failure log.

Safe model-failure diagnostics identify the actual provider and model attempted, while omitting the
internal route name, prompt, upstream body, cache usage, prices, exact cost snapshot, and credentials.

`POST /api/copilot/complete` queues a durable owner-scoped job and returns the typed job receipt; it
does not wait for or pretend to return completed Trip details. The callback reads the raw request,
verifies the `Upstash-Signature` against the configured callback URL, then validates the minimized
payload before invoking the completion processor.

The browser persists only the completion job id, idempotency key, and Trip id. It polls the
owner-scoped status route with a bounded loop, resumes that loop after refresh, and reloads the
authoritative Trip snapshot at a terminal state. The detail pass never creates a second chat bubble:
the latest assistant preview is updated in place. `partial`, `failed`, and `conflicted` remain visible
and truthful; retries are offered only for retryable jobs within the server-owned attempt limit.

## UI Rules

- The home page is a product-first landing surface: a single clear promise, an illustrative
  read-only workspace preview, scenario-grouped capabilities, and an ecosystem section establish
  the task. It never mounts the live composer or sends a request.
- `/visepanda` is the canonical interactive workspace. Desktop reserves roughly 65% for the
  read-only Trip Canvas and 35% for VisePanda conversation/composition. On narrow screens it
  switches between Trip and VisePanda views without unmounting their current conversation, draft,
  or Trip state. `/copilot` redirects there for compatibility.
- Public "Ask VisePanda" entries use a small allowlisted context key and prefill an editable draft;
  they never auto-send and never encode personal data or a full Trip in the URL.
- Home-page capability content is grouped by traveler scenario (before flying, on the move, and
  when plans change). Ecosystem surfaces appear in a separate section so one viewport has one
  primary job.
- The home product preview is illustrative only. It is labelled as not-live data, uses no live-status
  indicator, must not claim that bookings, payments, or Human Help have occurred, and must not
  introduce inert controls.
- A new visitor begins with no active request and no generated Trip. The prompt submit action remains
  disabled until the traveler enters or chooses a question.
- The canonical visual source is the Red Gold Design System.
- Public product routes share one navigation and footer rhythm. Floating navigation may use a
  translucent material, but content hierarchy and legibility take priority over decoration.
- The shared header exposes five primary destinations in one stable order: VisePanda, Explore,
  Guides, Rescue, and Human Help. Account uses the same ordinary, hover, and selected navigation
  treatment. Rescue is a fixed-category, deterministic routing chooser: its default route is
  unavailable unless a reviewed target is explicitly available; health/safety always directs to the
  official emergency boundary and never offers Human Help.
  The shared footer repeats those product destinations and every accepted trust/legal route.
- On narrow screens the VisePanda workspace uses a visible Trip/VisePanda switch rather than a
  forced two-column view. This is composition only; response, Trip, and completion behavior remain
  unchanged.
- Every shared header provides a keyboard-visible skip link to the content immediately after the
  navigation. Primary navigation and account targets remain at least 44 pixels high.
- Interactive controls provide immediate press feedback and preserve a 44-pixel minimum target.
  Reduced-motion, reduced-transparency, and increased-contrast preferences must retain a complete,
  understandable experience.
- Unknown, offline, demo, and failed states must be explicit.
- A disabled or unavailable action is hidden or clearly disabled; inert controls are not allowed.
- Commercial actions show disclosure and use `/outbound`.
- Responsive behavior is verified at 375, 768, 1280, and 1440 pixel widths.
- At narrow widths, primary navigation uses five equal tracks and prompt cards wrap their text; no
  VisePanda element may force horizontal page scrolling.

## Public Trust and Legal Pages

Every public route uses the shared footer, which links the Privacy Policy, Terms of Use, Affiliate
Disclosure, Human Help Disclaimer, and Emergency Disclaimer. Human Help also links its service
limits and emergency guidance at the point where a traveler submits a request. Public copy follows
the accepted [Phase 0 legal and trust baseline](../commercial/phase-0-public-legal-baseline.md): it
does not promise a self-service deletion control, a precise unverified retention period, payment,
an SLA, emergency response, or third-party fulfillment. A future commercial action must place an
affiliate disclosure before or adjacent to the action in addition to keeping the footer link.

Explore reads POIs through the runtime-owned KnowledgeService. Deployed modes therefore use the
durable Postgres adapter, while only explicit `local-demo` may render the labelled seed dataset.
Cards show short labels only for current reviewed `payment_acceptance`, `metro_access`,
`booking_required`/`reservation_helpful`, `crowd_pattern`, and `rainy_fit` facts. Unknown, expired,
unreviewed, deprecated, or unlabeled facts stay hidden; load failure produces an honest unavailable
state rather than fixture content. Explore tests construct facts through the authoritative domain
schema and include the evidence metadata required by the reviewed-fact eligibility boundary.

Explore and public POI pages share one pure public-fact projection. It runs the domain eligibility
check before returning a fact label, public source-class label, and UTC-formatted last-verified date.
The projection never returns source locators, evidence summaries, reviewer identity, or internal
authorization state. Unsupported source classes and incomplete facts fail closed together with their
receipt. Editorial guide pages do not currently render POI facts, so they do not fabricate a
provenance surface before that data relationship exists.

## Verification

```bash
pnpm --filter @visepanda/app-web typecheck
pnpm --filter @visepanda/app-web test
pnpm --filter @visepanda/app-web build
```

UI changes require desktop and mobile browser evidence. Route or metadata changes require a link and
indexing check.
