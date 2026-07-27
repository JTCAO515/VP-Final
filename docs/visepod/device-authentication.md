# VisePod Device Authentication

Status: draft candidate for Issue #282
Owner: architecture/security review, Hardware Agent evidence, Codex contract fixtures
Risk: D3 identity/security; Tier B

## Objective And Boundary

Freeze the smallest identity mechanism suitable for 3-5 controlled VisePod prototypes. A device may
obtain a short-lived session scoped only to the future Device API. It must never receive a Supabase
service role, model-provider key, user session cookie, Trip write credential, or reusable shared
server secret.

This document does not implement a Device Registry, Device API, gateway, WebSocket protocol, or
firmware. Those consumers remain locked behind the accepted Issue #282 contract and their own
schema-first Issues.

## P01 Candidate

Use an RSA-2048 key with RSA-PSS-SHA256 signatures through the ESP32-S3 RSA Digital Signature (DS)
peripheral:

- The device signs challenges without exposing the RSA private parameters to application code.
- The private parameters stored in flash are encrypted; the protecting HMAC key is burned into an
  eFuse block configured as unreadable.
- The server stores only the public key, SHA-256 public-key fingerprint, credential version, device
  status, provisioning metadata, and audit timestamps.
- TLS server-certificate verification remains mandatory. An application signature is defense in
  depth and does not replace TLS.

The candidate is based on official capability documentation, not purchased-board evidence. It does
not become accepted until the Hardware Agent completes the matrix below and an independent reviewer
accepts [ADR-0013](../adr/ADR-0013-visepod-device-authentication.md).

## Hardware Capability Matrix

| Capability        | Documented candidate evidence                                                          | Required physical-board evidence                                                                                  | Current result |
| ----------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------- |
| TLS               | ESP-TLS supports verified TLS clients on ESP32-S3                                      | Connect with the intended CA bundle; reject wrong host, expired certificate, and untrusted CA                     | Pending        |
| Entropy           | ESP32-S3 hardware RNG supplies entropy while Wi-Fi/BLE or the entropy source is active | Generate nonce/key material after entropy initialization; record API/result and firmware version, never key bytes | Pending        |
| Key isolation     | RSA DS encrypts private parameters using an unreadable eFuse-backed HMAC key           | Provision one sacrificial board; prove application code cannot read the HMAC/private material                     | Pending        |
| Signing           | RSA DS and its PSA driver support RSA signing                                          | Verify the shared RSA-PSS vector and measure 30 signatures p50/p95                                                | Pending        |
| Secure boot/flash | ESP32-S3 supports Secure Boot and Flash Encryption                                     | Lock at least one investor-demo unit; document irreversible fuses and recovery image before burning               | Pending        |
| Physical recovery | Board can be physically re-flashed before production locks                             | Revoke old credential, physically provision a new credential version, and reconnect                               | Pending        |

Primary sources:

- [Waveshare ESP32-S3-Touch-AMOLED-1.8](https://docs.waveshare.com/ESP32-S3-Touch-AMOLED-1.8)
- [ESP32-S3 random number generation](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/system/random.html)
- [ESP32-S3 RSA Digital Signature](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/peripherals/ds.html)
- [ESP32-S3 ESP-TLS](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/api-reference/protocols/esp_tls.html)
- [ESP-IDF security features](https://docs.espressif.com/projects/esp-idf/en/stable/esp32s3/security/security.html)

## Challenge Protocol V1

### Request Challenge

The future endpoint returns a server-generated challenge for a provisioned, non-revoked device.
The request may identify `deviceId` but does not authenticate through that value alone.

The server creates:

- `challengeId`: opaque UUIDv7-style identifier.
- `nonce`: 32 random bytes encoded as unpadded base64url.
- `issuedAtMs`: server Unix time in milliseconds.
- `expiresAtMs`: exactly 60 seconds after issuance.
- Redis record: one-time challenge state keyed by an HMAC/digest of `challengeId`, never by a private
  credential, with TTL no longer than 60 seconds.

The device clock is not trusted. The server decides issuance and expiry.

### Canonical Signed Bytes

The device signs UTF-8 bytes formed by these fields in this exact order:

```text
protocol
deviceId
credentialVersion
challengeId
nonce
issuedAtMs
expiresAtMs
audience
purpose
```

Rules:

- Values are joined by a single LF byte (`0x0A`).
- There is no trailing LF.
- Every value is ASCII and must reject CR or LF.
- Integers are unsigned base-10 strings without whitespace or leading `+`.
- `protocol` is `VPOD-AUTH/1`.
- `audience` is `visepanda-device-api`.
- `purpose` is `device_session`.
- Signature algorithm is RSA-PSS with SHA-256, MGF1-SHA256, and a 32-byte salt.
- Signature transport encoding is unpadded base64url.

The shared positive and negative fixtures are in
[`fixtures/device-auth-v1-vectors.json`](fixtures/device-auth-v1-vectors.json).

### Verify And Consume

The server must perform these checks in an order that does not disclose whether an unknown device
exists:

1. Validate shape and bounded lengths.
2. Load an active device and exact credential version through a server-only repository.
3. Reject revoked, disabled, or superseded credentials.
4. Check server-side challenge expiry.
5. Rebuild canonical bytes and verify RSA-PSS against the stored public key.
6. Atomically consume the challenge in Redis. A second valid consumer fails as replay.
7. Create a short-lived opaque session only after the successful atomic consume.

Public failures use stable, non-enumerating responses. Detailed reason codes are restricted to
sanitized operational evidence.

## Device Session Boundary

- Token material: 32 cryptographically random bytes, returned once over verified TLS.
- Server storage: SHA-256 token digest only; no raw token in database, Redis diagnostics, events, or
  logs.
- Token TTL: 5 minutes.
- Scope: exactly `device:session` in P01.
- Maximum connected session: 15 minutes from authentication, even if transport reconnects.
- Authorization: token can call only the future `/api/v1/device/*` surface explicitly mapped to this
  scope. It cannot call Web, Ops, Trip, Supabase, or arbitrary Copilot routes.
- Binding: one device id, one credential version, and one active session id.
- Refresh: not supported. The device obtains a new challenge and authenticates again.

## Provision, Rotate, Revoke

### Provision

Provisioning is manual and offline for P01:

1. Assign a random device id and human-readable asset label; the label is not an authenticator.
2. On the physical board, boot a single-purpose trusted provisioning image, initialize entropy,
   generate the HMAC and RSA material, encrypt the RSA parameters, burn the DS-purpose eFuse key,
   zero transient plaintext buffers, and remove the provisioning image. This candidate follows the
   documented on-device option and still requires Hardware Agent evidence before use.
3. Export only the public key and fingerprint through a local trusted cable workflow.
4. Import the public key, fingerprint, credential version `1`, board asset reference, and
   `provisioned_by` audit identity through a future operator-only CLI.
5. Complete a challenge-response test before the device leaves the provisioning station.
6. Seal and inventory any board whose Secure Boot/Flash Encryption/eFuse settings are locked.

Private parameters, eFuse/HMAC material, raw session tokens, signatures, and credentials must never
enter Git, GitHub, screenshots, tickets, chat, analytics, or general application logs.

### Rotate

P01 rotation requires physical custody. Provision a new device key and increment
`credentialVersion`. Activate the new public key only after its challenge passes, then revoke the old
credential. There is no remote secret recovery and no overlap longer than the controlled rotation
window.

### Revoke Or Lose

- Mark the device and every credential version revoked in the authoritative registry.
- Delete outstanding challenge and session records and disconnect any active transport.
- Future challenge requests and existing session checks fail closed.
- A recovered device remains revoked until physical re-provisioning creates a new credential version.
- A lost device is never restored by changing status alone.

Every state change records actor, device id, credential version, previous/new status, bounded reason,
and timestamp. It records no key, token, signature, cookie, user content, or provider credential.

## Exit Scheme

If physical-board evidence shows that RSA DS cannot be provisioned reliably, cannot satisfy the
signing latency budget, or cannot support the required secure lifecycle:

1. Stop downstream Device API and gateway implementation.
2. Revoke all prototype credentials and erase/re-provision all affected boards under physical
   custody.
3. Retain the protocol fixtures and experiment evidence.
4. Open a new D3 ADR for a secure-element or different-MCU design.

Do not silently downgrade to a plaintext/shared HMAC secret, a firmware-readable Ed25519 private key,
disabled TLS verification, or a hard-coded prototype credential.

## Verification Commands

```bash
node scripts/verify-visepod-auth-vector.mjs
pnpm docs:index
pnpm docs:check
pnpm docs:impact -- --base origin/main
```

Passing these checks proves only the deterministic contract fixture and documentation integrity. It
does not prove real-board key isolation, TLS, entropy, signing, revocation, or provisioning.
