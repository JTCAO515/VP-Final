# ADR-0025: VP-V3 Web Experience Layer

Date: 2026-08-21
Status: Accepted
Owner: product / architecture
Issue: [#552](https://github.com/JTCAO515/VP-Final/issues/552)

## Context

The current `apps/web` application is both the production traveler surface and the Next.js
composition boundary for Early Access, identity, Copilot, Trip, telemetry, Human Help, outbound, and
other server-owned capabilities. It already carries the accepted privacy, runtime-mode, rate-limit,
localization, legal, and honest-unavailable behavior. Rebuilding the experience by copying that
application would create a second implementation of security and data rules. Replacing it in place
would remove the known production rollback asset before the new experience has Preview evidence.

The operator has approved a complete rewrite of the traveler-facing frontend as the VP-V3 Web
experience program. This is a versioned delivery program, not a new public product name, repository,
backend, database, or commercial promise. ADR-0023 and
ADR-0024 remain the product authorities: VisePanda is the AI planning and execution workspace for
independent travel in China, with one Chatbot, one visible Trip state, and fact-first execution gates.

## Decision

### 1. Naming and repository ownership

- `VP-V3` is the internal program and release name. Public copy continues to use `VisePanda`.
- `JTCAO515/VP-Final` remains the only production repository. No V3 repository or Supabase project is
  created.
- The planned parallel application path is `apps/web-v3`. The historical prompt name
  `apps/web-next` is superseded to avoid confusing a permanent module with a temporary migration
  label.
- All traveler-facing screens are re-authored in `apps/web-v3` against the accepted contracts. This
  is not an in-place restyle or a wholesale copy of the legacy component/CSS tree. Reuse is reserved
  for authoritative contracts, legal bodies, design tokens, and independently suitable shared
  primitives.
- `apps/web` remains the production application and rollback asset until the cutover gate in #562 is
  independently accepted. It is not deleted, repurposed, or silently changed by V3 shell work.

### 2. Application and contract boundary

`apps/web-v3` owns only the new traveler experience and thin Next.js route adapters. It consumes the
existing authorities:

- `packages/domain` for runtime-validated business contracts and deterministic rules;
- `packages/ai` for provider-independent model behavior;
- `apps/server` for explicit services, persistence adapters, and module ownership;
- `packages/api-client` and `packages/ui` where their accepted contracts apply;
- the existing Supabase, Auth, TripPatch, fact-eligibility, audit, rate, cost, privacy, and retention
  boundaries.

The V3 app MUST NOT import implementation files from `apps/web`, copy its server composition root, or
proxy raw traveler data to the production Web deployment. Issue #554 must extract the smallest shared
Web server-composition boundary and prove current `apps/web` compatibility before V3 exposes a real
API consumer. Both apps may retain thin framework adapters, but the business operation and its
failure semantics have one owner.

This decision creates no domain, API, event, migration, permission, or runtime contract. Proposed
`TravelObjectCandidate`, Patch proposal, and Execution Action shapes remain `draft` until their own
Issues freeze all interface elements and tests.

### 3. V3 styling framework

`apps/web-v3` uses Tailwind CSS v4 as its styling framework. Tailwind is a utility and build layer,
not a new visual authority. #553 must bridge the canonical VisePanda Red-Gold CSS variables through
Tailwind v4 `@theme`, producing semantic utilities such as `bg-brand-gold`. It MUST NOT define a
parallel color palette or copy color literals into components.

All authored V3 component/page styling must use Tailwind v4 utility classes. V3 TypeScript/JSX MUST
NOT use arbitrary-value classes such as `bg-[#D4AF37]`, inline `style`, JSX `<style>` elements, or
component-local color literals. A required new value must first become a reviewed Red-Gold token and
then enter the `@theme` bridge. #553 must add repository-local Agent guidance and a mechanical source
check for these rules.

The legacy `apps/web` styling is not mass-migrated. It remains on the production-maintenance line
while new `apps/web-v3` code follows the Tailwind rule from its first component. Necessary legacy fixes
remain separate Issues; their existence does not authorize importing the old CSS/component tree into
V3.

### 4. Product-surface ownership

The V3 experience has three cooperating modes:

```text
Planner = discover and decide
Canvas  = remember and manage
Today   = execute and recover
```

- **Planner** accepts travel intent and may display only validated candidates with explicit source,
  eligibility, missing, conflict, or unavailable state. It does not write a Trip.
- **Canvas** is the single visible projection of the owner-scoped Trip, saved places, preparation,
  confirmed items, and open questions. It never becomes a second Trip writer.
- **Today** is the on-trip projection: Today, Next, at most one eligible practical action, and an
  honest recovery state. It does not infer live availability.
- **VisePanda Chatbot** remains the single conversational AI surface across these modes. Model output
  may propose typed changes, but only an explicit user confirmation plus deterministic validation,
  TripPatch application, audit, and persistence may change a Trip.

Discover, place detail, and preparation are supporting object/fact surfaces. They cannot promote a
candidate into a reviewed fact or activate booking, payment, navigation, or Human Help.

### 5. Route ledger

| V3 route                             | Planned owner           | Initial maturity        | Binding rule                                                                                              |
| ------------------------------------ | ----------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------- |
| `/`                                  | Early Access            | planned                 | One real form action only after the shared composition consumer exists; Product Preview remains labelled. |
| `/plan`                              | Planner                 | planned                 | Candidate/proposal only; no direct Trip write.                                                            |
| `/trip`                              | Canvas                  | planned                 | Owner-scoped Trip projection; mutations use the accepted Patch path only.                                 |
| `/today`                             | Today                   | planned                 | Eligible action or explicit missing/unavailable/recovery state.                                           |
| `/discover`                          | Knowledge discovery     | planned                 | Reviewed objects/facts only; no live-map or inventory implication.                                        |
| `/places/[slug]`                     | Place detail            | planned                 | Evidence-gated public projection; unsupported content is absent or 404.                                   |
| `/prepare`                           | Preparation             | planned                 | Fixed or reviewed preparation state; no inferred readiness fact.                                          |
| `/account`                           | Identity                | planned consumer        | Reuses the server-verified identity contract; no second Auth implementation.                              |
| Legal/trust routes                   | Compliance              | planned consumer        | Preserve the accepted canonical bodies and URLs; UI localization does not translate regulated content.    |
| `/api/*`, `/auth/callback`, webhooks | Thin framework adapters | not authorized by shell | Reuse accepted shared operations and exact auth/signature/error boundaries.                               |

Route presence in this ledger is planning evidence only. Until its Issue passes, a route must be
absent or render an explicit planned/unavailable state without a fake control.

The first implementation milestone is the Early Access vertical slice: V3 Shell (#553), shared Web
composition (#554), the Early Access page (#555), and an independent Vercel Preview deployment and
browser acceptance (#563). Planner, Canvas, Today, and other traveler surfaces do not begin until that
Preview gate has passed.

### 6. Legacy routing, cutover, and rollback

Before cutover, `apps/web` keeps its current routes and production authority. Issue #562 owns an exact
route inventory and classifies every current route as preserve, migrate, retire with `404 + noindex`,
or system-critical. A missing V3 capability MUST NOT be hidden behind a redirect that implies parity.
Legal pages, API paths, Auth callbacks, webhooks, and other required system paths remain available.

Production cutover requires all relevant GitHub checks at terminal success, V3 Preview evidence at
375/768/1280, English/Chinese/Spanish/Russian/Arabic and Arabic RTL verification, no horizontal
overflow or real console error, honest API failure behavior, SEO/noindex/sitemap checks, monitoring,
and a rehearsed rollback. Skipped, cancelled, rate-limited, or unavailable checks are not green.
Changing the Vercel production project, domain, DNS, Supabase, Resend, or another external console is
operator-only and must be recorded in the operator-action register.

Rollback before cutover is removal or disabling of the V3 Preview. Rollback after an authorized
cutover restores the last verified `apps/web` production deployment and route mapping; no data
rollback is implied because V3 must reuse the existing accepted data contracts.

## Consequences

- The program is decomposed by [the V3 plan](../planning/visepanda-v3-web-plan.md) and Issues
  #551-#563. Dependencies remain serial where an interface is not frozen.
- V3 gains an independent visual and interaction surface without gaining independent business,
  identity, data, or provider authority.
- The shared composition extraction in #554 is a required D2 contract/refactor gate, not optional
  cleanup.
- #553 implements the accepted Tailwind CSS v4 `@theme` bridge and style-policy checks before any
  later V3 traveler surface is authored.
- OA-031 and OA-032 remain open external-evidence gates. V3 documentation or Preview behavior cannot
  close them or support a production-live claim.

## Rejected Alternatives

1. **Rewrite `apps/web` in place.** Rejected because it removes the stable rollback surface and mixes
   migration with production behavior changes.
2. **Copy `apps/web` into a new app.** Rejected because Auth, API composition, rate limits, privacy,
   and honest failure paths would drift.
3. **Proxy V3 Preview submissions to production Web.** Rejected because it creates an unreviewed
   cross-deployment identity, trusted-address, cookie, and data-transfer boundary.
4. **Create a V3 backend or database.** Rejected because the accepted modular monolith and schema
   authorities already own these capabilities.

## Review and Supersession

This ADR is the accepted C4/D3 application-boundary amendment for Issue #552. A change to the public
product definition, repository/data ownership, route ledger, identity boundary, production cutover
authority, or rollback asset requires a superseding ADR and operator decision. Implementation facts
must be recorded in module documentation as their Issues merge; this ADR must not be edited to claim
planned behavior has shipped.
