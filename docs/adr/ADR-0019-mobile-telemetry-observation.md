# ADR-0019: Authenticated Mobile Telemetry Observation

Date: 2026-08-14
Status: Accepted
Owner: mobile / telemetry

## Decision

The Expo Execute shell records only six closed-set mobile observations: `app_opened`, `trip_opened`,
`offline_content_used`, `tool_opened`, `show_to_local_used`, and `human_help_submitted`. Each action
has a domain-owned fixed metadata shape. Raw traveler input, phrase text, Trip snapshots, contact
details, emails, credentials, tokens, and arbitrary properties are prohibited.

The mobile client may create a UUID only to make an offline retry idempotent. It saves at most 100
validated observations in a disposable local queue, sends them in order only after an authenticated
Supabase session is verified online, and removes each one only after a `202` response. A retry may
repeat a UUID but the durable ledger treats it as one observation. On sign-out, the client clears all
unsent observations so they cannot become associated with a later account on the same device.

The server owns identity, timestamp, surface, retention deadline, rate admission, and persistence.
The native route requires both the authenticated account and the trusted Vercel client-address
sliding-window guard before a write. Missing dependencies fail closed with a truthful unavailable
response; telemetry failure never changes the primary product action.

## Consequences

This extends ADR-0012's privacy-safe telemetry discipline to the controlled mobile shell without
creating a general mobile analytics collector or activating an external analytics provider. A future
mobile feature may emit one of these actions only when the corresponding user behavior truly exists;
adding an action, property, identity mode, or retention behavior requires domain, database, API,
test, and documentation review.
