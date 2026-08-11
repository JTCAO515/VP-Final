# VisePod Studio Binding Contract v1

Status: Draft

Owner: VisePod architecture / identity

Source of truth: Issue #335, [ADR-0017](../adr/ADR-0017-vise-pod-studio-provisioning.md),
and `packages/domain/src/visepod/studio.ts`.

## Purpose and boundary

This is the server-side contract for an internal VisePod Studio administrator
tool. It lets a verified Ops user bind a known VisePanda user to a known VisePod
`deviceId`. The binding exists only on the server. The device continues to store
only its device identity, device key, and venue Wi-Fi credentials; it does not
receive user identity, credentials, tokens, conversations, or recordings.

This document freezes a contract only. It does not implement a Studio app,
route, database table, token issuer, device registry, firmware update, speech
pipeline, or direct database connection from macOS.

## Authorization and grant lifecycle

1. An administrator signs into Studio through the existing Supabase-backed Ops
   authentication flow.
2. The server checks `visepod.provision` through the existing
   `opsAuthorizationService` before it reads a user, device, binding, or
   idempotency record.
3. An authorized session may receive an opaque, `visepod.provision`-only
   provisioning token from `POST /api/ops/visepod/provisioning-token`.
4. The token expires exactly eight hours after issuance. Studio keeps it only in
   macOS Keychain; no file, log, crash report, clipboard, or audit record may
   contain it.
5. Every protected request validates the token online: active grant, scope,
   expiry, matching environment, and the issuing user's current permission.
   Revoking the grant or the user's permission is immediately effective.
6. Development and production use different Supabase projects, issuer material,
   grant records, and tokens. A `development` token is rejected in production,
   and vice versa.

The token is a credential, not a user/session substitute. It cannot call any
other Ops endpoint or weaken the existing Ops authorization checks.

## Endpoints

All endpoints below are future server endpoints. Token issuance uses the verified
Ops session plus current `visepod.provision`; it cannot accept a provisioning
token in place of that session. The remaining protected endpoints require
`Authorization: Bearer <opaque provisioning token>` and must validate the
environment-matching grant plus the issuing user's current
`visepod.provision` permission before protected data is read or written.

### `POST /api/ops/visepod/users/resolve`

Resolve exactly one existing user by a full email or UUID. The body is strict:

```json
{ "email": "traveler@example.test" }
```

or:

```json
{ "userId": "00000000-0000-4000-8000-000000000002" }
```

Exactly one field is required. Partial email, prefix lookup, similar-match
lists, pagination, cursor parameters, and a browse/list route do not exist.
On a match, the minimal response is:

```json
{
  "user": {
    "userId": "00000000-0000-4000-8000-000000000002",
    "displayName": null,
    "emailHint": "t***@example.test"
  }
}
```

`emailHint` is optional and always masked. A full email never appears in a
response or URL.

### `GET /api/ops/visepod/devices/{deviceId}/binding`

Return the current server-side binding for one known device. A device with no
binding returns `200` with `{ "binding": null }`. A binding has only the
device id, user id, active state, server timestamps, and server-derived actor:

```json
{
  "binding": {
    "deviceId": "device-001",
    "userId": "00000000-0000-4000-8000-000000000002",
    "state": "active",
    "boundAt": "2026-08-11T00:00:00.000Z",
    "boundBy": "00000000-0000-4000-8000-000000000001"
  }
}
```

### `PUT /api/ops/visepod/devices/{deviceId}/binding`

Bind an unbound device, or explicitly rebind a bound device. The path owns the
`deviceId`; the strict body is:

```json
{
  "userId": "00000000-0000-4000-8000-000000000002",
  "idempotencyKey": "00000000-0000-4000-8000-000000000003",
  "reason": "Assign the demonstration device to the selected traveler."
}
```

### `DELETE /api/ops/visepod/devices/{deviceId}/binding`

Revoke a current binding. The strict JSON body is:

```json
{
  "idempotencyKey": "00000000-0000-4000-8000-000000000003",
  "reason": "Remove the device from the completed demonstration."
}
```

The response contains a `binding` of `null` after a successful revoke. It does
not delete a device identity or its device secret.

## Binding and idempotency rules

- `deviceId` keeps the VisePod v1 RFC 3986 unreserved-character rule and is
  1-64 characters.
- `idempotencyKey` is a UUID, retained for 30 days.
- A canonical write payload includes operation, path `deviceId`, requested user
  when present, reason, and key.
- The same key and canonical payload is a replay: return the original business
  outcome and binding projection with `idempotencyHit: true`; do not change state
  or write another audit event.
- The same key with a different canonical payload is a conflict, never an
  overwrite.
- A later request with a new key is evaluated as a new command. Binding a
  different user is an explicit rebind, never an implicit merge.

`outcome` is one of `created`, `rebound`, or `revoked`; it describes the first
business result. `idempotencyHit` is only a replay receipt and never becomes a
separate business or audit outcome.

## Frozen response forms

All errors have the strict form `{ "error": { "code": "..." } }` and contain
no additional diagnostic values, raw credentials, or user data.

| Situation                                                                | HTTP  | Response                                                 | Audit result                         |
| ------------------------------------------------------------------------ | ----- | -------------------------------------------------------- | ------------------------------------ |
| First binding                                                            | `201` | `{ outcome: "created", idempotencyHit: false, binding }` | One `visepod.binding.created` event. |
| Same write replay                                                        | `200` | Original outcome/projection with `idempotencyHit: true`. | No new event.                        |
| Explicit rebind                                                          | `200` | `{ outcome: "rebound", idempotencyHit: false, binding }` | One `visepod.binding.rebound` event. |
| Device absent                                                            | `404` | `{ error: { code: "DEVICE_NOT_FOUND" } }`                | No binding mutation.                 |
| User absent                                                              | `404` | `{ error: { code: "USER_NOT_FOUND" } }`                  | No binding mutation.                 |
| Missing, expired, revoked, mismatched-environment, or unauthorized grant | `403` | `{ error: { code: "PROVISIONING_ACCESS_DENIED" } }`      | No binding mutation.                 |
| Same idempotency key, changed canonical payload                          | `409` | `{ error: { code: "IDEMPOTENCY_KEY_CONFLICT" } }`        | No binding mutation.                 |

The regular binding-read response is `200 { "binding": null }` for a present,
unbound device; it is not a `DEVICE_NOT_FOUND` substitute.

## Audit contract

The only audit sink is the existing server-only `ops_audit_events` relation.
For the first committed state mutation, the server derives the existing actor
and timestamp and writes:

```json
{
  "action": "visepod.binding.created",
  "targetType": "visepod_device_binding",
  "targetId": "device-001",
  "metadata": {
    "deviceId": "device-001",
    "previousUserId": null,
    "nextUserId": "00000000-0000-4000-8000-000000000002",
    "result": "succeeded"
  }
}
```

The permitted actions are `visepod.binding.created`,
`visepod.binding.rebound`, and `visepod.binding.revoked`. Audit metadata is
strict: it excludes full email, password, raw token, device secret, Wi-Fi
password, user credentials, session data, chat, and audio. Replays write no
second audit event.

## Versioning and implementation gate

This v1 contract changes only additively. A field removal, response-shape
change, looser authorization, user browsing capability, longer or offline token,
or environment sharing requires a new D2/D3 reviewed decision. Issues #336 and
#337 may implement this only after ADR-0017 is accepted and must add server-side
authorization-before-data, immediate-revocation, idempotency, and audit-atomicity
tests.

## Verification

```bash
pnpm --filter @visepanda/domain typecheck
pnpm --filter @visepanda/domain test
pnpm --filter @visepanda/domain lint
```

The executable schemas reject ambiguous user lookups, unmasked email output,
changed idempotency reuse, revoked/cross-environment grant use, and unknown
secret-bearing fields. No live Studio credential, server route, or device write
is exercised by this contract-only Issue.
