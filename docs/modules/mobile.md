# Mobile Module

Path: `apps/mobile`

## Responsibility

Mobile is the future Expo React Native application for the in-China Execute stage: Today, offline
Trip access, Tools, Show to Local, Human Help, and account state.

## Current State

The package is an Expo SDK 55 shell with four static Execute-stage tabs: Today, Tools, Help, and Me.
It imports `mobileTheme` from `@visepanda/ui`: a React Native-ready projection of the canonical
red/gold token record, including accessible semantic states, 44pt button minimums, cards, type scale,
spacing, and radii. The shell imports shared domain content but makes no real API call. Its Today,
Help, and Me surfaces explicitly report their unavailable state; Tools displays local preparation
content only. The portable `OfflineTripPackage` domain contract is available for a future
local-storage/AsyncStorage consumer, but no mobile synchronization, download, account state, Human
Help submission, or write path exists. This is a controlled pre-production boundary, not a public
offline-product claim.

The Translation item opens a local Show to Local phrase-card view. Restaurant, taxi, and hotel cards
have fixed ordinary Chinese wording and support on-device copy plus local `expo-speech` playback.
Allergy/dietary, symptom/medical, and emergency categories intentionally show ADR-0016's fixed
English unavailable state until a current operator-reviewed expression is supplied through a future
controlled sync; they do not expose a Chinese value, copy button, or speech button. This is a safety
boundary, not a missing-network fallback, and the shell makes no translation-service claim.

## Start Trigger

Mobile implementation begins only after Phase 1 quality and demand triggers are met: meaningful
weekly usage or Human Task volume, acceptable Copilot success, repeat visits, a concentrated city
need, and no open P0 security or fulfilment risk.

The shell exists under the controlled pre-production implementation override. It MUST remain disabled
for public capability claims until the relevant live dependencies and lifecycle trigger are recorded.

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
pnpm --filter @visepanda/app-mobile export
```

`pnpm --filter @visepanda/app-mobile ios` requires Xcode and an installed iOS Simulator on the local
machine. It was not treated as verified when those developer tools are absent.
