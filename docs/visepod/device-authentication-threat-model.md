# VisePod Device Authentication Threat Model

Status: draft for Issue #282 independent review
Review owner: security/architecture reviewer and Hardware Agent

## Assets And Trust Boundaries

Protected assets are the device private identity, short-lived session token, user/Trip binding,
Device API authority, provisioning authority, revocation state, and sanitized security audit trail.

Trust boundaries:

1. Physical board and its eFuses/flash.
2. Offline provisioning station and physical custodian.
3. Untrusted Wi-Fi and the public Internet.
4. Future Device API edge and Redis challenge/session store.
5. Authoritative device registry and operator-only mutations.
6. Existing VisePanda user, Trip, Copilot, and observability services.

The display, asset label, device id, local Wi-Fi, client clock, request headers, and application logs
are not trusted identity roots.

## Threats And Required Controls

| Threat                  | Attack                                                                              | Required P01 controls                                                                                                                                                                                                                                       | Evidence before downstream implementation                                                               |
| ----------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Device teardown         | Attacker opens a lost unit and reads flash/debug interfaces                         | RSA DS private parameters encrypted at rest; unreadable eFuse HMAC key; one locked demo unit with Secure Boot, Flash Encryption, and reviewed JTAG/download policy                                                                                          | Hardware Agent fuse report, readback-failure proof, recovery/brick-risk checklist                       |
| Replay                  | Captured challenge response or session token is reused                              | 32-byte nonce; 60-second server TTL; atomic one-time challenge consume; 5-minute token TTL; 15-minute absolute session; revoke checks on every authenticated operation/connection                                                                           | Shared replay/expiry vectors plus Redis atomic-consume integration test                                 |
| Device clone            | Public identifiers or copied flash are placed on another board                      | Private signing capability remains bound to unreadable eFuse material; server verifies exact public key and credential version; duplicate concurrent identity can be quarantined                                                                            | Two-board clone attempt with copied application flash fails authentication                              |
| Log leakage             | Token, signature, key, cookie, prompt, or user data enters logs/telemetry           | Allowlisted metadata only; token digest server-side; secret-key-name/value and forbidden-field assertions; bounded normalized errors                                                                                                                        | Server/firmware log scan and automated forbidden-field test                                             |
| Lost or stolen device   | Attacker has a valid physical device                                                | Operator revoke removes challenges/sessions and disconnects transport; future checks fail; no user profile, Trip snapshot, history, or provider key stored on device                                                                                        | Revoke-under-active-session test; recovered unit requires physical new-version provisioning             |
| Provisioning compromise | Station, provisioning firmware, or operator exports transient reusable key material | Offline single-purpose station; reviewed one-time on-device provisioning image; transient buffers zeroed; image removed; public-key-only export; named custodian; two-person inventory for locked units; no cloud/chat/ticket transport of private material | OA-017 custody decision, firmware hash, witnessed provisioning record, and post-provision readback test |
| Server impersonation    | Captive portal or hostile Wi-Fi intercepts device                                   | ESP-TLS hostname and CA verification; no insecure fallback; application signature never substitutes for TLS                                                                                                                                                 | Wrong-host, expired-CA, and untrusted-CA physical-board tests                                           |
| Randomness failure      | Weak key/nonce generation enables prediction                                        | Entropy source initialized before generation; server nonces use platform CSPRNG; health failure stops provisioning/authentication                                                                                                                           | Firmware API evidence and repeated RNG health/sanity test without recording random values               |
| Authorization expansion | Device token reaches Web/Trip/Ops or another device                                 | Exact `device:session` scope; server-side device/session binding; explicit Device API allowlist; deny by default                                                                                                                                            | Route matrix allow/deny tests before #286/#288 merge                                                    |
| Stale credential        | Rotated credential remains usable                                                   | Credential version in signed bytes; old version revoked after controlled handoff; no refresh token                                                                                                                                                          | Rotation vector and old-version rejection test                                                          |
| Denial of service       | Challenge flood or expensive signature verification                                 | Per-device/IP edge limits, bounded payloads, challenge issuance limits, cheap shape/status checks before crypto                                                                                                                                             | Runtime safety contract in downstream Issue; no P01 availability promise                                |

## Data Minimization

The device may retain only firmware/configuration required to boot, network configuration under the
approved device policy, its hardware-backed credential material, public service endpoints, and
ephemeral in-memory session state. It must not persist:

- VisePanda user profile, email, account token, signed anonymous cookie, or Supabase credential;
- Trip state, preference profile, conversation history, prompt, transcript, or raw audio;
- model-provider, STT, or TTS credentials;
- raw challenge signatures or session tokens after the active exchange.

Server audit records use device id, credential version, event type, normalized result, actor for
operator mutations, and timestamp. They exclude key material, token/token digest in general logs,
signature bytes, cookie values, user content, and raw provider errors.

## Security Profiles And Claims

- Development boards may remain recoverable for iteration, but must be labeled `development` and
  cannot support a tamper-resistance claim.
- At least one physically inventoried investor-demo unit must complete the reviewed lock procedure
  before any statement that credentials are hardware-isolated.
- The other units' profile must be visible in demo/ops evidence; a development unit must not be
  presented as locked.
- P01 is a controlled prototype. It has no public device SLA, emergency role, safety guarantee,
  payment authority, or autonomous booking authority.

## Residual Risks And Stop Conditions

Residual risk remains from physical fault injection, supply-chain compromise, provisioning-station
malware, certificate expiry, experimental firmware defects, and denial of service on venue Wi-Fi.
P01 does not claim resistance to laboratory-grade invasive attacks.

Stop VisePod runtime work and follow the ADR exit scheme if any of these occurs:

- private/HMAC material is readable by application code after intended lock;
- TLS verification requires an insecure bypass;
- copied flash authenticates on a second board;
- revocation cannot terminate an active session promptly;
- provisioning cannot be performed reproducibly without exporting reusable private material;
- the operator cannot name a physical provisioning/custody owner and location.

## Review Triggers

Re-open this threat model before public sale, self-service pairing, OTA credential rotation, fleet
management, multiple users per device, payment/booking authority, wake-word listening, persistent
audio, or a different MCU/secure element. Each changes assets or trust boundaries and requires a new
D3 decision.
