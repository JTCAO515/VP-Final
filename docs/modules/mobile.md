# Mobile Module

Path: `apps/mobile`

## Responsibility

Mobile is the future Expo React Native application for the in-China Execute stage: Today, offline
Trip access, Tools, Show to Local, Human Help, and account state.

## Current State

The package is an Expo SDK 55 shell with four Execute-stage tabs: Today, Tools, Help, and Me.
Its React 19.2.0 and React Native 0.83.10 pair is the Expo SDK 55-compatible baseline and is checked
with `expo-doctor`; do not independently move either version without passing that check.
It imports `mobileTheme` from `@visepanda/ui`: a React Native-ready projection of the canonical
red/gold token record, including accessible semantic states, 44pt button minimums, cards, type scale,
spacing, and radii. The shell imports shared domain content. A signed-in traveler can use
`GET /api/mobile/trips` to load only the Trips owned by a server-verified Supabase session, choose
one, and save the existing sanitized `OfflineTripPackage` locally. The app never connects to Postgres,
uses a service-role key, or exposes a Trip write path. The access and refresh tokens are held only by
`expo-secure-store`; the offline cache holds no credential. Network, session, and response failures
leave an existing cache unchanged and show an honest state.

The Help tab submits a Shanghai controlled-preview Human Help request through
`POST /api/mobile/human-help`. It uses only an HTTPS Supabase Bearer access token; the Web boundary
verifies that token online and derives an authenticated owner before calling the existing Human Task
service. Native clients do not present a browser anonymous cookie and cannot select an owner. A saved
read-only Trip can prefill an editable description from its first block, but the app never sends a Trip
snapshot or block metadata. The request body is sent only after an explicit submit. It is not queued
offline: a network or runtime failure explicitly means no request was submitted. The response exposes
only the minimal task receipt, while the server retains the contact and description under the existing
Human Task privacy/retention boundary. One form session retains its UUID idempotency key across an
uncertain retry and starts a new key only after a confirmed receipt. The app emits
`human_help_submitted` only after that receipt.

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

After a verified mobile sign-in, the shell records a bounded, privacy-safe mobile observation queue.
The only registered actions are `app_opened`, `trip_opened`, `offline_content_used`, `tool_opened`,
`show_to_local_used`, and `human_help_submitted`; the current shell emits only actions for behavior
that actually exists. It never records an input draft, message, Trip snapshot, email, token, contact,
or phrase text. Each queued observation has a client-generated UUID solely for retry idempotency;
the server derives the account owner, timestamp, surface, and retention deadline after online session
validation. The app stores at most 100 observations in a separate disposable FileSystem file, retries
in order every 30 seconds while a verified session remains available, and removes an item only after
the server returns HTTP 202. A malformed queue is cleared rather than guessed. Sign-out clears unsent
observations before another account can use the device; existing offline Tool and Trip content follows
its separate cache policy.

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
- Queue privacy-safe telemetry offline and flush after reconnect only through `POST /api/mobile/telemetry`.
  The queue is authenticated-account-only, bounded to 100 entries, and must be cleared on sign-out.
- Consume `TOOLS_CONTENT_PACK` as local preparation content only. It does not establish live booking,
  exchange, emergency, partner, or translation-service availability; a future UI must hide a target
  it cannot resolve honestly.
- Human Help uses `POST /api/mobile/human-help` only for a verified account. It keeps its submission
  outside the offline queue, sends no raw Trip data, and must retain the existing controlled-preview,
  capacity, non-emergency, and no-SLA policy text.

## Current Verification

`build` is intentionally a TypeScript-only verification (`tsc --noEmit`), not an iOS binary or
Expo export. Its package-specific Turbo task therefore declares no filesystem outputs; Turbo caches
the command log without pretending that a `dist` directory exists. `export` remains the explicit
command for a local Expo export when that artifact is needed.

```bash
pnpm --filter @visepanda/app-mobile typecheck
pnpm --filter @visepanda/app-mobile test
pnpm --filter @visepanda/app-mobile build
pnpm --filter @visepanda/app-mobile export
```

`pnpm --filter @visepanda/app-mobile ios` requires Xcode and an installed iOS Simulator on the local
machine. It was not treated as verified when those developer tools are absent.
