# ADR-0014: VisePod Uses One HTTPS Request Per Turn

Date: 2026-07-27

Status: Accepted

Decider: architecture owner through Issue #283

Owner: VisePod architecture

Review date: Before any v2 device protocol or transport change

## Context

Earlier planning assumed Cat.1 cellular connectivity and a persistent WebSocket
gateway. The physical VisePod baseline is Wi-Fi-only, and the interaction is
half-duplex push-to-talk. Public Wi-Fi, captive portals, and NAT idle timeouts
make a permanently held socket an operational liability without providing a
necessary user benefit for one recorded turn followed by one spoken response.

Provider-level WebSocket experiments remain separate implementation choices. They
do not define the device-to-VisePanda transport.

## Decision

VisePod v1 sends each recorded PCM turn through one signed HTTPS `POST` to
`/api/pod/v1/turn` and receives an indexed sequence of playback segments in the
response. Health uses a separate HTTPS `GET` to `/api/pod/v1/health`.

The device transport will not use WebSocket, Cat.1, SSE, long polling, or a
client-held server session. HTTPS must verify the host and certificate.

The complete request, response, signing, error, and compatibility contract lives
in [Device Protocol v1](../visepod/device-protocol-v1.md) and its executable
domain schemas.

## Consequences

- A turn can safely reconnect for every press-to-talk exchange.
- Server autoscaling and observability remain ordinary request/response concerns.
- Playback is ordered by explicit segment index, never by an assumed response
  array order.
- Firmware and server must share the canonical HMAC vector before real traffic
  can be enabled.
- A future genuinely duplex interaction needs a new architecture decision and a
  versioned protocol; it cannot silently repurpose v1.

## Verification

- Domain tests validate strict request, response, health, signing-vector, and
  sentence-boundary behavior.
- Firmware and server implementations must independently pass the published HMAC
  vector.
- A later weak-network test covers public Wi-Fi, captive-network failure, NAT
  expiry, weak signal, and packet loss using one-request turn recovery.

## Rollback

There is no runtime route in this decision. Do not reintroduce the earlier
WebSocket assumption into v1. If HTTPS proves insufficient after measured device
evidence, propose a separately reviewed v2 transport and signing contract.
