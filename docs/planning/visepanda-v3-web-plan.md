# VP-V3 Web Experience Plan

Date: 2026-08-21
Status: active planning
Owner: product / architecture / Web
Authority: [ADR-0025](../adr/ADR-0025-vp-v3-web-experience-layer.md)
Program: [#551](https://github.com/JTCAO515/VP-Final/issues/551)

## Outcome

Rewrite and validate the complete traveler-facing frontend as a parallel VP-V3 application inside the
current monorepo while retaining `apps/web` as the production and rollback application. Screens and
interaction composition are re-authored rather than copied wholesale from the legacy component/CSS
tree. V3 must make planning, visible Trip state, and on-trip action/recovery easier to understand
without inventing facts or duplicating Auth, server, database, AI-router, Trip-write, audit, privacy,
or commercial paths.

This plan is not implementation or production evidence. GitHub Issues are the live work queue, merged
PRs are implementation evidence, and external/production state remains governed by runbooks and the
operator-action register.

## Objective and Control Loop

| Element         | VP-V3 definition                                                                                                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `r` target      | A traveler can enter through honest Early Access, express intent in Planner, inspect one Trip in Canvas, and see one truthful next action or recovery in Today.                             |
| `y` observation | Issue/PR checks, contract tests, AI evals where applicable, Preview smoke, 375/768/1280 screenshots, five-locale/RTL, overflow, console, accessibility, SEO/noindex, and rollback evidence. |
| `e` deviation   | Current Web has substantial production-safe capability but no parallel V3 experience, shared two-app composition contract, or V3 cutover ledger.                                            |
| `u` control     | The serial Issues below, each no larger than five focused days and each independently reversible.                                                                                           |
| Owner/cadence   | Codex owns implementation/review; operator owns public promise and external cutover; evidence is reviewed per PR and again at Preview/cutover.                                              |

## Scope and Anti-goals

In scope:

- `apps/web-v3` experience shell and responsive Red-Gold presentation;
- complete re-authoring of traveler-facing screens, starting with Early Access;
- Early Access, Planner, Canvas, Today, Discover, place, preparation, account, and trust route ownership;
- shared Web runtime composition needed by both Web apps;
- typed candidates and confirmed Patch proposals;
- truthful Preview, route retirement matrix, SEO/noindex, monitoring, and rollback evidence.

Out of scope:

- a second repository, backend, database, Supabase schema, Auth implementation, model Router, Trip
  writer, fact store, payment route, or operator console;
- direct model writes, arbitrary URL/tool payloads, universal travel-task state machines, live map or
  inventory claims, automatic booking, payment, Human Help SLA, or complete China coverage;
- production cutover, DNS, domains, secrets, migrations, or external-console actions without an
  explicit operator gate.

## Dependency Graph

```text
#552 V3 architecture baseline
  ├─> #553 Web V3 shell
  │     └─> #554 shared Web composition ─> #555 Early Access ─> #563 Vercel Preview gate
  └─> #563 unlocks the remaining frontend rewrite
        ├─> #556 static Planner
        ├─> #557 TravelObjectCandidate contract
        └─> #559 read-only Canvas

#530 scoped-fact persistence + #554 + #556 + #557
  └─> #558 real Planner candidates

#557 + #558 + #559
  └─> #560 confirmed Patch proposal

#558 + #560 + ADR-0023 fact gates
  └─> #561 Today action/recovery

#555 + #558 + #560 + #561
  └─> #562 Preview, route matrix, cutover and rollback evidence
```

Unfrozen cross-module contracts remain serial. PR bases are always current `main`; stacked PRs are
forbidden.

## Executable Issue Ledger

| Order | Issue                                                          | Boundary                                            | Size | State at plan freeze                      | Exit evidence                                                                                                    |
| ----- | -------------------------------------------------------------- | --------------------------------------------------- | ---- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1     | [#552 V3-01](https://github.com/JTCAO515/VP-Final/issues/552)  | ADR, app/route ownership, rollback                  | M    | in progress                               | registered accepted ADR, plan, module boundary, docs gates                                                       |
| 2     | [#553 V3-02](https://github.com/JTCAO515/VP-Final/issues/553)  | `apps/web-v3` Shell, tokens, i18n/RTL               | M    | blocked by #552                           | app typecheck/test/build plus responsive/RTL evidence                                                            |
| 3     | [#554 V3-03](https://github.com/JTCAO515/VP-Final/issues/554)  | shared Web server composition                       | L    | blocked by #552/#553                      | compatibility and consumer contract tests, no copied API                                                         |
| 4     | [#555 V3-04](https://github.com/JTCAO515/VP-Final/issues/555)  | real Early Access consumer                          | M    | blocked by #553/#554                      | honest API-state and five-locale browser evidence                                                                |
| 5     | [#563 V3-04b](https://github.com/JTCAO515/VP-Final/issues/563) | Early Access Vercel Preview and browser acceptance  | S    | blocked by #555                           | Ready Preview URL/commit, deployment checks, five locales/RTL, responsive/console/overflow, Production unchanged |
| 6     | [#556 V3-05](https://github.com/JTCAO515/VP-Final/issues/556)  | static Planner experience                           | M    | blocked by #563                           | zero-write preview and empty-state browser evidence                                                              |
| 7     | [#557 V3-06](https://github.com/JTCAO515/VP-Final/issues/557)  | `TravelObjectCandidate` Domain contract             | M    | blocked by #563 and #530 consumption gate | schema/pure tests and eligibility boundary                                                                       |
| 8     | [#558 V3-07](https://github.com/JTCAO515/VP-Final/issues/558)  | real structured Planner candidates                  | L    | blocked by #530/#554/#556/#557            | contract/integration/evals and honest no-match/conflict                                                          |
| 9     | [#559 V3-08](https://github.com/JTCAO515/VP-Final/issues/559)  | read-only Canvas projection                         | M    | blocked by #563/#554                      | owner-scoped read and responsive browser evidence                                                                |
| 10    | [#560 V3-09](https://github.com/JTCAO515/VP-Final/issues/560)  | confirmed Patch proposal                            | L    | blocked by #557/#558/#559                 | auth/replay/conflict/audit/TripPatch tests and UI diff                                                           |
| 11    | [#561 V3-10](https://github.com/JTCAO515/VP-Final/issues/561)  | Today action/recovery projection                    | M    | blocked by #558/#560                      | eligible/unavailable/recovery and high-risk fail-closed tests                                                    |
| 12    | [#562 V3-11](https://github.com/JTCAO515/VP-Final/issues/562)  | full Preview, legacy route matrix, cutover/rollback | L    | blocked by V3 consumers                   | terminal checks, E2E, SEO/noindex, monitoring and rollback rehearsal                                             |

## Route and Maturity Plan

| Route            | Planner/Canvas/Copilot role | Before its Issue merges                                    |
| ---------------- | --------------------------- | ---------------------------------------------------------- |
| `/`              | Early Access acquisition    | absent or explicit Preview; no fake submission             |
| `/plan`          | discover and decide         | static labelled preview only after #556                    |
| `/trip`          | remember and manage         | no state inference; read-only only after #559              |
| `/today`         | execute and recover         | unavailable until eligible action inputs exist             |
| `/discover`      | fact/object discovery       | honest empty/planned state; no live map implication        |
| `/places/[slug]` | evidence-gated detail       | 404 when unsupported                                       |
| `/prepare`       | fixed/reviewed preparation  | no inferred readiness or commercial CTA                    |
| `/account`       | identity consumer           | unavailable until shared accepted Auth adapter is consumed |

## Acceptance Matrix

| Dimension        | Required program evidence                                                                                                |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Functional       | Each Issue acceptance command passes; V3 E2E covers acquisition, plan, inspect, propose/confirm, execute/unavailable.    |
| Interface        | Shared composition and candidate/Patch consumers have compatibility tests; no client enum or server implementation copy. |
| Data             | No new datastore; any future migration is append-only, separately reviewed, and not part of shell work.                  |
| Security/privacy | Server-derived identity, trusted addresses, secret-safe logging, RLS/service boundaries, and no raw production proxy.    |
| Performance      | V3 Preview build and interaction observations are recorded; numeric targets wait for a measured baseline.                |
| UX/accessibility | 375/768/1280, five locales, Arabic RTL, keyboard, reduced motion, contrast, no horizontal overflow or inert controls.    |
| Observability    | Preview console and route errors are observable; production monitoring/owner/rollback exists before cutover.             |
| Compliance       | Existing legal bodies and public-claim restrictions remain authoritative; previews and unavailable states are explicit.  |

## Cutover and Rollback

#562 must inventory every `apps/web` route and protect legal, API, Auth callback, webhook, share,
outbound, robots, sitemap, and other system paths. Unmigrated product routes return `404 + noindex`
only after their replacement is accepted; they are not silently redirected to a partial V3 surface.

Before operator approval, V3 remains Preview-only and production stays on `apps/web`. After an
authorized cutover, rollback restores the last verified `apps/web` deployment and route mapping.
Skipped or unavailable provider checks cannot authorize either action.

## Expected Handoff Delta

After #552 merges, a separate serialized snapshot action should record ADR-0025, #551-#563, the
Preview-only maturity, the Early Access-first/shared-composition gates, and #553 as the next executable action. This plan
does not edit `docs/handoff.json` because its branch is not merged truth.
