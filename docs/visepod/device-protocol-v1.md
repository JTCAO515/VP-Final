# VisePod Device Protocol v1

Status: Accepted

Owner: VisePod architecture

Source of truth: Issue #283 and the executable schemas in
`packages/domain/src/visepod/index.ts`.

## Purpose and boundary

VisePod v1 carries exactly one push-to-talk turn over one HTTPS request. It is a
device-to-server contract, not a streaming protocol and not a provider protocol.
This document freezes validation and signing semantics before a route is
implemented.

V1 does not define STT, TTS generation, a WebSocket, device enrollment, replay
storage, or a commercial action. A future server route must add those concerns
without changing the wire shapes below.

## Transport

| Endpoint             | Method | Success response                                 | Purpose                                                               |
| -------------------- | ------ | ------------------------------------------------ | --------------------------------------------------------------------- |
| `/api/pod/v1/turn`   | `POST` | `200 application/json`                           | Submit one signed raw PCM turn and receive ordered response segments. |
| `/api/pod/v1/health` | `GET`  | `200 application/json` or `503 application/json` | Report only whether the turn service is ready to accept work.         |

The device uses HTTPS with normal certificate and hostname verification. It must
not fall back to HTTP, a persistent WebSocket, or a provider-specific socket.
One HTTPS request maps to one half-duplex push-to-talk turn, which is robust to
public Wi-Fi, NAT idle expiry, and captive-network behavior.

`POST /api/pod/v1/turn` has these headers:

```http
Content-Type: application/octet-stream
X-VisePod-Metadata: <compact UTF-8 JSON described below>
```

The body is the raw PCM payload. It is not multipart, base64, chunked streaming,
or a JSON audio field. The server must reject an unexpected content type or a
payload that exceeds the declared v1 limit.

## Request metadata and audio

`X-VisePod-Metadata` is a strict JSON object; unknown fields are rejected.

```json
{
  "version": 1,
  "deviceId": "device-001",
  "timestamp": 1700000000,
  "nonce": "0123456789abcdef",
  "payloadSha256": "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  "signature": "a104199354d94841a5a9b454f45aa8696287817c9fd37fc9f81c324f303cf36f",
  "payloadBytes": 5
}
```

| Field           | Requirement                                                            |
| --------------- | ---------------------------------------------------------------------- |
| `version`       | Literal integer `1`.                                                   |
| `deviceId`      | 1-64 characters, RFC 3986 unreserved only: `[A-Za-z0-9-._~]`.          |
| `timestamp`     | Positive base-10 Unix seconds represented as a JSON safe integer.      |
| `nonce`         | 16-64 characters, RFC 3986 unreserved only: `[A-Za-z0-9-._~]`.         |
| `payloadSha256` | Lowercase 64-character SHA-256 hex digest of the raw body.             |
| `signature`     | Lowercase 64-character HMAC-SHA256 hex signature described below.      |
| `payloadBytes`  | Positive integer equal to the raw body byte length and at most 960000. |

`deviceId` and `nonce` are deliberately not URL-decoded, normalized, or
case-folded. Rejecting all other characters prevents firmware and server from
signing different interpretations of the same value.

Audio is PCM signed 16-bit little-endian, 16 kHz, mono. The raw body is at most
960000 bytes, equivalent to at most 30 seconds at the frozen format. V1 does not
allow Opus, WAV headers, stereo, resampling negotiation, or a larger payload.

## HMAC-SHA256 signing

The signing version is the literal `VISEPOD-HMAC-SHA256-V1`. The device and
server build the following five UTF-8 lines, joined by ASCII LF (`\n`) with no
trailing newline:

```text
VISEPOD-HMAC-SHA256-V1
<deviceId>
<timestamp in decimal>
<nonce>
<payload SHA-256 lowercase hex>
```

The signature is lowercase hexadecimal `HMAC-SHA256(device_secret, canonical)`.
The future route must hash the received raw bytes, compare that result to
`payloadSha256`, then compare HMAC values in constant time. It must not trust the
declared byte count, payload hash, or signature before verification.

### Authoritative cross-language vector

This vector is intentionally public and uses a non-production test key. It is
exported as `VisePodSignatureVector` and tested in
`packages/domain/src/visepod/index.test.ts`. Firmware and server implementations
must pass it unchanged.

| Input             | Value                                                              |
| ----------------- | ------------------------------------------------------------------ |
| Key hex           | `000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f` |
| `deviceId`        | `device-001`                                                       |
| `timestamp`       | `1700000000`                                                       |
| `nonce`           | `0123456789abcdef`                                                 |
| Raw payload UTF-8 | `hello`                                                            |
| Payload SHA-256   | `2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824` |

Canonical string:

```text
VISEPOD-HMAC-SHA256-V1
device-001
1700000000
0123456789abcdef
2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
```

Expected signature hex:

```text
a104199354d94841a5a9b454f45aa8696287817c9fd37fc9f81c324f303cf36f
```

## Turn response

The successful response is a strict JSON object:

```json
{
  "version": 1,
  "segments": [
    {
      "index": 0,
      "text": "Welcome to Shanghai.",
      "audio": "https://audio.example.test/pod/turn/0",
      "durationMs": 1000
    }
  ]
}
```

`segments` contains 1-8 sentence-sized playback units. `index` is required,
unique, and contiguous from zero through `segments.length - 1`; clients sort by
`index` and must not depend on JSON array order. Each `text` is nonempty,
well-formed UTF-8 and at most 256 UTF-8 bytes. Each `audio` is a credential-free
HTTPS URL at most 192 UTF-8 bytes. `durationMs` is a positive integer at most 120000.

`mock://` locators are only a firmware host-test convenience. A live `/turn`
response must never emit them. The locator's content format and retrieval
authorization are intentionally deferred; they must be introduced additively.

Sentence splitting is deterministic, before the response is serialized. The
shared pure function preserves common titles such as `Mr.`, initialisms such as
`U.S.`, and decimal values such as `3.5` as internal punctuation. It has no model
call and must be used as a bounded presentation step, not a language guarantee.

## Error responses and firmware prompts

Errors are strict JSON and omit internal/provider details:

```json
{
  "version": 1,
  "error": {
    "code": "RATE_LIMITED",
    "retryAfterMs": 10000
  }
}
```

`retryAfterMs` is optional, positive, and at most 300000. The static firmware
prompt is selected by code; the server does not return an unreviewed message.

| Code                                                                          | HTTP | Firmware prompt                                                        |
| ----------------------------------------------------------------------------- | ---- | ---------------------------------------------------------------------- |
| `UNSUPPORTED_VERSION`                                                         | 426  | This VisePod needs an update.                                          |
| `INVALID_METADATA`, `INVALID_DEVICE_ID`, `INVALID_TIMESTAMP`, `INVALID_NONCE` | 400  | I could not read that request. Please try again.                       |
| `PAYLOAD_TOO_LARGE`                                                           | 413  | That recording is too long. Please try a shorter message.              |
| `PAYLOAD_HASH_MISMATCH`, `INVALID_SIGNATURE`                                  | 401  | I could not verify this device request. Please try again.              |
| `REPLAY_DETECTED`                                                             | 409  | That request has already been used. Please try again.                  |
| `DEVICE_UNAUTHORIZED`                                                         | 403  | This VisePod is not ready yet.                                         |
| `RATE_LIMITED`                                                                | 429  | I need a moment. Please try again shortly.                             |
| `UPSTREAM_UNAVAILABLE`                                                        | 503  | I cannot reach the travel assistant right now. Please try again later. |
| `INTERNAL_ERROR`                                                              | 500  | Something went wrong. Please try again later.                          |

`GET /api/pod/v1/health` returns `{ "version": 1, "status": "ready" }` only
when the turn service can accept work. Otherwise it returns status `503` with
`status: "unavailable"` and one of the error objects above. It is not an
authentication, provider-diagnostic, or device-enrollment endpoint.

## Versioning and future work

After v1 ships, v1 changes are additive only: optional fields, additional error
codes consumed as unknown-safe by clients, and additive response metadata may be
introduced only with compatibility tests. A changed signing string, a changed
audio format/limit, a removed or retyped field, or new required behavior requires
`/api/pod/v2/*` and a new signing vector.

The next dependent work owns device authorization and replay prevention,
server-side turn composition, speech adapters, response-audio access, and
firmware consumption. It must keep this contract and vector intact.
