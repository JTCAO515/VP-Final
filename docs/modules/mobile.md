# Mobile Module

Path: `apps/mobile`

## Responsibility

Mobile is the future Expo React Native application for the in-China Execute stage: Today, offline
Trip access, Tools, Show to Local, Human Help, and account state.

## Current State

The package is an Expo SDK 55 shell with four Execute-stage tabs: Today, Tools, Help, and Me.
It imports `mobileTheme` from `@visepanda/ui`: a React Native-ready projection of the canonical
red/gold token record, including accessible semantic states, 44pt button minimums, cards, type scale,
spacing, and radii. The shell imports shared domain content. A signed-in traveler can use
`GET /api/mobile/trips` to load only the Trips owned by a server-verified Supabase session, choose
one, and save the existing sanitized `OfflineTripPackage` locally. The app never connects to Postgres,
uses a service-role key, or exposes a Trip write path. The access and refresh tokens are held only by
`expo-secure-store`; the offline cache holds no credential. Network, session, and response failures
leave an existing cache unchanged and show an honest state. Help remains unavailable and no Human
Help submission path exists.

The Translation item opens a local Show to Local phrase-card view. Restaurant, taxi, and hotel cards
have fixed ordinary Chinese wording and support on-device copy plus local `expo-speech` playback.
Allergy/dietary, symptom/medical, and emergency categories intentionally show ADR-0016's fixed
English unavailable state until a current operator-reviewed expression is supplied through a future
controlled sync; they do not expose a Chinese value, copy button, or speech button. This is a safety
boundary, not a missing-network fallback, and the shell makes no translation-service claim.

The shell also uses Expo FileSystem to persist one validated `OfflineMobileCache` in the app document
directory. It contains the versioned local Tools and Show to Local packs, a refresh timestamp, and an
optional sanitized `OfflineTripPackage`; it never contains an auth token or an invented Trip. Tools
offers a manual local refresh and clear action. A failed parse deletes the disposable cache and reports
that result; refresh rebuilds from the app's bundled content and is not represented as a server sync.
Today separately labels its authenticated Trip load and always requires the traveler to choose a
snapshot before replacing the local Trip.

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
- Keep authentication tokens in platform-secure storage. `EXPO_PUBLIC_SUPABASE_URL`,
  `EXPO_PUBLIC_SUPABASE_ANON_KEY`, and `EXPO_PUBLIC_VISEPANDA_WEB_URL` are public build-time
  configuration only, never database/service-role credentials; missing or malformed values disable
  the corresponding path honestly.
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
