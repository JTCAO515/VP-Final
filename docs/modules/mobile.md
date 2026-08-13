# Mobile Module

Path: `apps/mobile`

## Responsibility

Mobile is the future Expo React Native application for the in-China Execute stage: Today, offline
Trip access, Tools, Show to Local, Human Help, and account state.

## Current State

The package is a TypeScript compilation placeholder importing the domain version. It is intentionally
not an Expo application yet. It now imports `mobileTheme` from `@visepanda/ui`: a React Native-ready
projection of the canonical red/gold token record, including accessible semantic states, 44pt button
minimums, cards, type scale, spacing, and radii. The portable `OfflineTripPackage` domain contract
is also available for a future local-storage/AsyncStorage consumer, but no mobile synchronization,
download, or write path exists. This is a controlled pre-production boundary, not a public
offline-product claim.

## Start Trigger

Mobile implementation begins only after Phase 1 quality and demand triggers are met: meaningful
weekly usage or Human Task volume, acceptable Copilot success, repeat visits, a concentrated city
need, and no open P0 security or fulfilment risk.

## Future Boundaries

- Consume shared domain schemas and the typed API client.
- Never connect directly to Postgres or use a service-role key.
- Cache the versioned read-only `OfflineTripPackage` before enabling mobile writes. It carries a
  Trip snapshot, tool/phrase versions, city list, and expiry, strips arbitrary block metadata, and
  rejects credential-shaped strings.
- Keep authentication tokens in platform-secure storage.
- Separate digital entitlements from real-world service payments.
- Queue privacy-safe telemetry offline and flush after reconnect.
- Consume `TOOLS_CONTENT_PACK` as local preparation content only. It does not establish live booking,
  exchange, emergency, partner, or translation-service availability; a future UI must hide a target
  it cannot resolve honestly.

## Current Verification

```bash
pnpm --filter @visepanda/app-mobile typecheck
pnpm --filter @visepanda/app-mobile test
pnpm --filter @visepanda/app-mobile build
```
