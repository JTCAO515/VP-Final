# VisePod Documentation

VisePod is the Wi-Fi voice companion device that can call VisePanda. Its device
protocol is an independent, versioned public contract. Firmware, server, and
operators must use the same contract and the same HMAC test vector before any
live device turn is enabled.

## Reading order

1. [Device Protocol v1](device-protocol-v1.md) for the frozen request, response,
   signing, error, and versioning contract.
2. [ADR-0014](../adr/ADR-0014-vise-pod-https-turn-transport.md) for the decision
   to use one HTTPS request per push-to-talk turn instead of a persistent socket.
3. `packages/domain/src/visepod/index.ts` for the executable Zod contract and
   cross-language signing fixture.
4. [VisePod Studio Binding Contract v1](studio-binding-contract-v1.md) for the
   separate, server-side user/device provisioning boundary.
5. [ADR-0017](../adr/ADR-0017-vise-pod-studio-provisioning.md) for why Studio
   reuses Ops authorization, issues a short-lived grant, and forbids user
   browsing.

## Boundary

This directory freezes contracts only. It does not implement `/api/pod/v1/turn`,
speech-to-text, text-to-speech, device authorization, replay storage, firmware
delivery, a Studio route, a provisioning-token issuer, or a device-binding store.
Those consumers must validate against the v1 schema rather than extend a wire or
authorization format ad hoc.
