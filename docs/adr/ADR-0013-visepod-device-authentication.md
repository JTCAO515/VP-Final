# ADR-0013: VisePod Prototype Device Authentication

Date: 2026-07-27
Status: Proposed
Deciders: independent architecture/security reviewer, Hardware Agent capability owner, operator for
physical custody
Owner: device identity / security architecture
Review trigger: physical-board evidence for Issue #282, or any MCU/secure-element change

## Context

VisePod needs a device identity for 3-5 controlled investor prototypes. Issue #282 correctly rejects
the earlier idea of storing only a hash of a shared HMAC secret: a server cannot verify HMAC with a
one-way hash alone. Retaining a recoverable shared secret would require an accepted KMS/envelope-
encryption boundary that the current stack does not have.

The purchased Waveshare board uses ESP32-S3. Espressif documents a hardware RSA Digital Signature
path in which encrypted private parameters are stored in flash and the protecting HMAC key is kept in
an unreadable eFuse block. The Issue's preferred Ed25519 approach has no equivalent documented
ESP32-S3 hardware-isolated path in the accepted evidence set; a software Ed25519 key would be readable
by compromised firmware.

Official documentation demonstrates candidate capability, not successful provisioning or security
on the purchased unit. This ADR therefore remains proposed until Hardware Agent evidence and
independent Tier B review are complete.

## Proposed Decision

For P01, use per-device RSA-2048-PSS-SHA256 challenge signatures through the ESP32-S3 RSA DS
peripheral. Store only each public key, SHA-256 fingerprint, credential version, lifecycle status,
and bounded audit metadata on the server.

Freeze these protocol boundaries:

- canonical LF-delimited fields and RSA-PSS parameters defined in
  [device-authentication.md](../visepod/device-authentication.md);
- server-generated 32-byte nonce, 60-second one-time challenge, and atomic Redis consume;
- opaque 32-byte session token, digest-only server storage, 5-minute token TTL, exact
  `device:session` scope, and 15-minute absolute connected-session limit;
- server-authoritative credential version and revocation on every authenticated operation or
  connection;
- manual, offline, physical provisioning and rotation for P01;
- verified TLS with no certificate-validation bypass.

The shared fixture in
[`device-auth-v1-vectors.json`](../visepod/fixtures/device-auth-v1-vectors.json) is the cross-firmware/
server contract seed. Future runtime schemas may wrap it but must not change its field semantics
without a successor ADR and fixture version.

## Alternatives Considered

### Ed25519 keypair in application flash

Rejected for P01. Public-key authentication is desirable, but the current evidence does not show an
ESP32-S3 hardware-isolated Ed25519 private-key path. Flash encryption alone does not keep a key from
authorized compromised firmware at runtime.

### Shared HMAC secret stored as a hash

Rejected as non-functional. A verifier needs the HMAC secret; a one-way hash is insufficient.

### Shared HMAC secret under KMS/envelope encryption

Not selected. It adds a recoverable server-side symmetric identity root, KMS ownership, key rotation,
and blast radius that are unnecessary for 3-5 prototypes. It requires a separate accepted D3
architecture if reconsidered.

### Plain secret or hard-coded prototype token

Rejected. It creates clone and repository/log leakage risks and cannot support credible revocation.

## Consequences

- Firmware and server must implement RSA-PSS parameters identically and consume the shared vector.
- Provisioning has irreversible eFuse/lock risks and needs an operator-owned physical procedure.
- A device can authenticate without the server retaining a recoverable device secret.
- Public identifiers and copied flash alone must not clone a locked device.
- The Device API remains a separate least-privilege surface; this credential grants no traveler,
  Trip, Ops, payment, or provider authority.
- Hardware capability, latency, and revocation remain release evidence, not assumptions.

## Exit Decision

If the purchased board cannot provision and use RSA DS reliably, cannot meet the accepted signing
latency, or cannot support the required physical lifecycle, stop downstream VisePod runtime work.
Revoke all prototype credentials, physically erase/re-provision affected boards, and open a new D3
ADR for a secure element or different MCU. Do not downgrade in place to shared plaintext HMAC,
firmware-readable Ed25519, disabled TLS verification, or a permanent token.

## Verification Required For Acceptance

- Shared positive signature and altered-message negative vector pass in repository CI.
- Hardware Agent proves TLS verification, entropy initialization, RSA DS provisioning/signing,
  private-material non-readability, and physical re-provisioning on the purchased board.
- A copied-flash clone attempt fails on a second board.
- Active-session revocation and replay tests pass against the eventual server runtime.
- OA-017 names the provisioning custodian/location and records sanitized evidence without key
  material.

## Rollback

Before runtime launch, retire this proposal with no system effect. After prototype provisioning,
revoke every device/credential version, delete outstanding challenge/session state, physically
erase/re-provision the devices, and keep only sanitized audit and test evidence.
