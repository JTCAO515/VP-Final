# Web V3 Module

Path: `apps/web-v3` (planned; directory does not exist at ADR freeze)
Status: planned
Authority: [ADR-0025](../adr/ADR-0025-vp-v3-web-experience-layer.md)
Program: [#551](https://github.com/JTCAO515/VP-Final/issues/551)

## Responsibility

Web V3 will re-author the complete traveler-facing frontend for Early Access, Planner, Canvas, Today,
Discover, place detail, preparation, account, and accepted trust routes. It is an experience and thin
framework adapter, not a second business/runtime system, and it does not wholesale-copy the legacy
`apps/web` component/CSS tree.

Current implementation truth: no `apps/web-v3` directory, deployable, Preview, route, runtime API,
or production behavior exists. [#553](https://github.com/JTCAO515/VP-Final/issues/553) is the first
implementation Issue after the architecture baseline merges.

The first vertical milestone is Early Access only: #553 creates its Shell, #554 provides the shared
runtime boundary, #555 re-authors the root page, and #563 triggers an independent Vercel Preview and
browser acceptance. Other traveler surfaces remain blocked until that deployment gate passes.

## Ownership Boundary

Web V3 will consume, not replace:

- Domain schemas and pure rules from `packages/domain`;
- model routing and normalized AI output from `packages/ai` and `apps/server`;
- server-owned identity, Trip, Knowledge, Early Access, telemetry, Human Help, commerce, rate, audit,
  privacy, retention, and persistence services;
- the canonical Red-Gold variables and accepted public legal/trust bodies.

It MUST NOT import source implementation from `apps/web`, copy that app's API composition root, query
server-owned tables directly, or create app-local versions of domain enums. #554 owns the shared Web
composition extraction. Until it merges, V3 Shell work has no authority to expose a real API action.

## Planned Surfaces

| Surface            | Responsibility                                        | First owning Issue                           |
| ------------------ | ----------------------------------------------------- | -------------------------------------------- |
| `/`                | one-action Early Access with labelled product preview | #555                                         |
| `/plan`            | intent input, candidates, honest map/object state     | #556 static; #558 real candidates            |
| `/trip`            | one owner-scoped Trip Canvas projection               | #559                                         |
| `/today`           | next eligible action or recovery                      | #561                                         |
| `/discover`        | supporting reviewed object/fact discovery             | #553 skeleton; later evidence-gated consumer |
| `/places/[slug]`   | evidence-gated place detail                           | #553 skeleton; later evidence-gated consumer |
| `/prepare`         | fixed/reviewed preparation state                      | #553 skeleton; later bounded consumer        |
| `/account`         | existing server-verified identity consumer            | #553 skeleton; #554 shared composition       |
| legal/system paths | accepted bodies and exact security adapters           | #553/#554; final inventory #562              |

## Planned UI Rules

- English is default; Chinese, Spanish, Russian, and Arabic are catalogued UI locales. Arabic uses
  RTL. Browser UI localization does not rewrite Trip data, model output, facts, provider errors,
  disclosures, legal bodies, or safety content.
- Tailwind CSS v4 is the V3 styling framework. Its `@theme` bridge maps the canonical VisePanda
  Red-Gold variables into semantic utilities such as `bg-brand-gold`; it does not define a competing
  palette.
- All authored V3 page/component styles use Tailwind v4 utility classes. Arbitrary-value classes such
  as `bg-[#D4AF37]`, inline `style`, JSX `<style>` elements, and component-local color literals are
  prohibited. New values enter the reviewed Red-Gold token authority before the `@theme` bridge.
- #553 adds an `apps/web-v3/AGENTS.md` rule and a mechanical source test for the styling boundary.
  The legacy `apps/web` remains on a separate maintenance line and is not mass-migrated or imported.
- Controls are at least 44 pixels, keyboard-visible, and honest. A planned, disabled, missing,
  conflicted, expired, or unavailable capability is explicit; inert controls and fake success are
  prohibited.
- UI changes require 375, 768, and 1280 pixel browser evidence, no horizontal overflow, Arabic RTL,
  console inspection, and applicable reduced-motion/contrast checks.

## Planned Data and Mutation Rules

- Planner model output is a candidate or Patch proposal, never a fact or direct write.
- Canvas reads the server-owned current Trip. A change requires explicit confirmation, base version,
  idempotency, deterministic validation, TripPatch/CanvasPatch application, and audit.
- Today exposes only an eligible execution action. Missing evidence produces an unavailable state,
  what is missing, a safe alternative, and a later verification/recovery path.
- Commercial actions still require accepted partner state, disclosure, and `/outbound`; V3 does not
  activate them by rendering a card.

## Dependencies and Verification

The authoritative dependency graph and acceptance matrix are in
[the V3 plan](../planning/visepanda-v3-web-plan.md). When the module becomes implemented, this document
must be updated in the same source PR with exact routes, interfaces, tests, runtime maturity,
deployment ownership, and remaining gaps.

The planned module-level check names are:

```bash
pnpm --filter @visepanda/app-web-v3 typecheck
pnpm --filter @visepanda/app-web-v3 test
pnpm --filter @visepanda/app-web-v3 build
```

They are not runnable until #553 creates the package. No check is claimed as passed here.

## Rollback

Before production cutover, remove or disable the V3 Preview and leave `apps/web` unchanged. After an
authorized cutover, follow the #562 runbook to restore the last verified `apps/web` deployment and
route mapping. This module owns no independent data rollback.
