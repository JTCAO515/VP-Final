# VisePod Device Domain v1

Status: Accepted

Owner: VisePod architecture

Source of truth: `packages/domain/src/visepod/index.ts`.

## Purpose

This document defines the portable device-control vocabulary that later Registry,
authentication, gateway, simulator, and monitoring consumers must share. It is a
domain-only contract: it creates no database table, device credential, route, or
speech provider call.

## Lifecycle and binding

Device lifecycle is independent from user binding:

```text
inventory -> provisioned -> active -> suspended -> active
                                  -> revoked -> retired
                                  -> retired
```

`inventory` may move directly to `retired` without a provisioning timestamp; `provisioned`, `active`, and
`suspended` may move to `revoked` or `retired`. `revoked` may only move to
`retired`; it can never return to an operational state. Binding is a separate
`unbound | bound` status. A historical binding does not make a device usable:
only `active + bound` is turn-eligible.

The domain device object contains no user identifier. The existing Studio binding
contract remains the sole owner of user/device association and history.

## Portable records

- `VisePodDeviceProvisioningRequest` identifies only a device and the literal
  `clientType: "visepod"`; it contains no credential or secret.
- `VisePodDeviceSession` is a transport-neutral correlation descriptor. Token,
  signature, and authentication semantics are deferred to the device-authentication
  runtime.
- `VisePodDeviceHeartbeat` carries device/session timing only, never a user id,
  token, audio, or device secret.
- `VisePodAudioFormat` fixes PCM S16LE, 16 kHz, 16-bit, mono so consumers cannot
  negotiate a contradictory format.
- `VisePodDeviceLifecycleTestVector` exports accepted and rejected transition
  pairs for a firmware host test or computer simulator. It is not a provisioning
  payload and contains no device-specific data.

## Error boundary

`VisePodDeviceControlErrorCode` is for private Registry and control-plane
consumers. These errors are all non-retryable for the same request: the operator
must provision, bind, reactivate, or replace the device/session. They must not
replace the public `/api/pod/v1/turn` error response defined by
[Device Protocol v1](device-protocol-v1.md), which deliberately avoids device
enumeration detail.

## Compatibility and follow-up

This is additive to Device Protocol v1 and uses the same `deviceId` and audio
constants. Device Registry (#285) may persist these schemas only after the device
authentication boundary is accepted. A future field that changes lifecycle
meaning, introduces a device credential, or adds user authorization requires a
separate reviewed contract.
