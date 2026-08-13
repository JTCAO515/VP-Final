# ADR-0017: VisePod Studio Uses Scoped Ops Provisioning

Date: 2026-08-11

Status: Accepted

Decider: architecture owner through Issue #335; accepted 2026-08-13

Owner: VisePod architecture / identity

Review date: Before public device rollout or any expansion beyond the controlled VisePod Studio scope

## Context

VisePod Studio is an internal macOS tool for assigning a VisePod demonstration
device to a known VisePanda user. The device privacy boundary is already frozen:
the device stores only its `device_id`, device key, and venue Wi-Fi credentials.
It never stores a user email, password, token, session, chat, or recording. The
user-to-device relationship therefore belongs only to the server.

The repository already has one trusted internal authorization authority:
authenticated Ops sessions, `opsAuthorizationService`, `ops_memberships`, and
the append-only `ops_audit_events` relation. A second Studio-specific identity
or a searchable user directory would add a new revocation path and create an
unnecessary user-enumeration surface for three demonstration devices.

## Decision

### Reuse one Ops authorization source

Issue #337 must add the single explicit permission `visepod.provision` to the
existing Ops permission service. Studio endpoints require that exact permission
before looking up a user, device, binding, or idempotency record. No client
metadata, email address, navigation visibility, local role cache, or static
Studio secret is authorization.

The permission is not inferred from hierarchy. The implementation must declare
its role assignment in the same `opsAuthorizationService` matrix and test it.
Revoking the underlying Ops membership or its `visepod.provision` permission
makes every outstanding provisioning token unusable on the next request.

### Issue an online-validated provisioning grant

An authenticated, authorized Ops session may call the future
`POST /api/ops/visepod/provisioning-token` endpoint. It returns one opaque
bearer token with only the `visepod.provision` scope and an absolute expiry of
eight hours after issuance. The server retains a non-secret grant record with
the issuing Ops user, environment, expiry, and revocation state; the raw token
is never persisted, logged, audited, or returned by another endpoint.

Every successful token issuance and every explicit grant revocation must
atomically append one row to the existing `ops_audit_events` relation. The
actions are exactly `visepod.provision.token_issued` and
`visepod.provision.token_revoked`. The event uses the server-derived issuing or
revoking Ops user as actor, `visepod_provisioning_grant` as target type, and the
non-secret persisted grant id as target id. Bounded metadata records only the
grant environment and result. It must never contain the raw token, a token
fragment or digest, an email address, a user credential, a device secret, a
session, chat, or audio. A failed grant mutation writes neither a successful
grant state nor one of these committed-action events.

Every Studio operation must validate all of the following online, before
touching protected data:

1. the presented opaque token maps to an active grant;
2. its only scope is `visepod.provision`;
3. it has not expired or been explicitly revoked;
4. its `development` or `production` environment equals the serving project;
5. the issuing Ops user still has `visepod.provision` through the existing
   authorization service.

Studio keeps the token only in macOS Keychain. It must not write it to a file,
preferences store, diagnostic log, crash report, clipboard, or audit metadata.
Development and production use separate Supabase projects, issuer material, and
grant records. A token record is environment-bound, and an environment mismatch
is denied rather than redirected or retried against another project.

Either explicit grant invalidation or removal of the underlying permission is
immediate because validation is online for every protected call; natural expiry
is not the only revocation mechanism.

### Permit exact user resolution, not browsing

The future exact resolver accepts exactly one complete email address or one
`user_id` in a request body. It returns one record or the same `USER_NOT_FOUND`
shape. It offers no prefix search, similar matches, pagination, list endpoint,
or cursor. The response may carry only `userId`, nullable display name, and a
masked email hint; it never returns a full email, credentials, or session data.

The resolver uses `POST` so an email is not embedded in a URL, browser history,
or routine access log. It still requires `visepod.provision` before any lookup.
A fleet-scale search capability needs a separate D2 decision with an
enumeration threat model, query rate limits, and audit policy.

### Freeze binding, idempotency, and audit semantics

The future API uses these paths; this ADR and the companion contract document
do not implement them:

| Method   | Path                                          | Purpose                                                           |
| -------- | --------------------------------------------- | ----------------------------------------------------------------- |
| `POST`   | `/api/ops/visepod/provisioning-token`         | Exchange a verified Ops session for one short-lived Studio token. |
| `POST`   | `/api/ops/visepod/users/resolve`              | Resolve exactly one full email or `user_id`.                      |
| `GET`    | `/api/ops/visepod/devices/{deviceId}/binding` | Read one device's current server-side binding.                    |
| `PUT`    | `/api/ops/visepod/devices/{deviceId}/binding` | Bind or rebind that device to one resolved user.                  |
| `DELETE` | `/api/ops/visepod/devices/{deviceId}/binding` | Revoke that device's current binding.                             |

`PUT` and `DELETE` require a UUID `idempotencyKey` and a bounded operator
reason. The idempotency record is retained for 30 days. The canonical payload
includes the operation, path `deviceId`, requested user when present, reason,
and key:

- the same key and canonical payload returns the original business result and
  binding projection, with `idempotencyHit: true`; it performs no second state
  mutation and writes no second audit event;
- the same key with any different canonical payload returns `409
IDEMPOTENCY_KEY_CONFLICT` and preserves the original result;
- a new key is a new request, subject to ordinary authorization and state
  checks.

The sole audit destination is `ops_audit_events`. A committed first binding
mutation writes one event with the server-derived actor and timestamp plus
bounded metadata: `deviceId`, `previousUserId`, `nextUserId`, and `result`.
Its action is exactly one of `visepod.binding.created`,
`visepod.binding.rebound`, or `visepod.binding.revoked`. Provisioning grant
issuance and explicit revocation use the two actions and bounded grant metadata
defined above. An idempotent binding replay never produces its own audit
action. Audit and API responses must not include a password, raw provisioning
token, token fragment or digest, device secret, Wi-Fi password, user
credential, session, chat, or audio.

## Consequences

- Studio has no embedded long-lived production credential and no second
  authorization truth source.
- A lost or misconfigured Studio installation cannot enumerate all VisePanda
  users through a browse endpoint.
- Binding state is server-side and can be revoked without changing device
  firmware or writing user data to a device.
- The later implementation needs a durable grant store, binding store, and
  idempotency record, but this ADR deliberately does not choose their tables or
  implement their routes.
- Any future multiple-scope Studio token, offline grant validation, shared
  development/production project, or user search requires a separately reviewed
  decision.

## Verification

- `packages/domain/src/visepod/studio.ts` validates request and response shapes,
  an eight-hour environment-bound grant, strict exact lookup, idempotency
  comparison, and bounded audit metadata.
- Its tests reject raw emails in a lookup response, unknown secret-bearing
  fields, changed payload reuse, revoked grants, and cross-environment grants.
- Issues #336 and #337 must add route, persistence, permission, authorization
  ordering, immediate revocation, and audit-transaction tests before any Studio
  tool can use this contract.

## Rollback

This is a contract-only decision with no deployed Studio route or token issuer.
Do not bypass it with a desktop-held secret or a direct database client. If the
contract proves unsuitable before implementation, supersede this accepted ADR
through a new reviewed ADR and revise the executable schema before consumer work
begins.
