# Mobile Module

Path: `apps/mobile`

## Responsibility

Mobile is the future Expo React Native application for the in-China Execute stage: Today, offline
Trip access, Tools, Show to Local, Human Help, and account state.

## Current State

The package is a TypeScript compilation placeholder importing the domain version. It is intentionally
not an Expo application yet. This is a roadmap decision, not a missing Phase 0 deliverable.

## Start Trigger

Mobile implementation begins only after Phase 1 quality and demand triggers are met: meaningful
weekly usage or Human Task volume, acceptable Copilot success, repeat visits, a concentrated city
need, and no open P0 security or fulfilment risk.

## Future Boundaries

- Consume shared domain schemas and the typed API client.
- Never connect directly to Postgres or use a service-role key.
- Cache a versioned read-only offline Trip package before enabling mobile writes.
- Keep authentication tokens in platform-secure storage.
- Separate digital entitlements from real-world service payments.
- Queue privacy-safe telemetry offline and flush after reconnect.

## Current Verification

```bash
pnpm --filter @visepanda/app-mobile typecheck
pnpm --filter @visepanda/app-mobile test
pnpm --filter @visepanda/app-mobile build
```
