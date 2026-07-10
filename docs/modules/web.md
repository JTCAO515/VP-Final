# Web Module

Path: `apps/web`

## Responsibility

The public Next.js application owns acquisition and traveler-facing Phase 0 experiences. It renders
the Copilot workspace, Trip Canvas, Explore, guides, POI pages, Human Help, public Trip shares, and
the outbound gateway.

## Routes

| Route | Purpose |
| --- | --- |
| `/` | Copilot workspace and Trip Canvas |
| `/explore` | Execution-fact discovery |
| `/guides/[slug]` | Editorial execution guides |
| `/[city]/[poi]` | Programmatic POI page |
| `/human-help` | Human Task request surface |
| `/share/trips/[token]` | Public read-only Trip share |
| `/outbound` | Validated partner redirect gateway |
| `/api/copilot` | First-pass Copilot request |
| `/api/copilot/complete` | Silent second-pass completion |
| `/api/trips/*` | Trip read, claim, and share handlers |

## Data Access

The current Next.js API layer creates an in-process server caller. If `DATABASE_URL` exists, Trip and
knowledge use Postgres adapters; otherwise they fall back to process memory. This is useful for
development but is forbidden for production by the deployment constraints.

The Human Help and outbound ledgers still contain app-local paths that must be consolidated into
server services before public launch.

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
