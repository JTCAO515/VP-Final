# VisePod Prototype Documentation

Status: draft prototype boundary

VisePod is a controlled 3-5 device investor prototype. It is a restricted physical entry point to
the existing VisePanda Copilot, not a second user, Trip, or AI platform. Nothing in this directory is
evidence of a production fleet, public sale, service-level agreement, or hardware security claim.

## Required Reading

1. [Device authentication](device-authentication.md) - candidate P01 identity protocol,
   provisioning, short-lived session, rotation, and revocation.
2. [Device authentication threat model](device-authentication-threat-model.md) - assets, trust
   boundaries, controls, residual risks, and prototype stop conditions.
3. [ADR-0013](../adr/ADR-0013-visepod-device-authentication.md) - proposed credential-root decision
   awaiting independent Tier B review and physical-board evidence.
4. [Shared test vectors](fixtures/device-auth-v1-vectors.json) - deterministic challenge signature,
   token-policy, replay, expiry, and revocation expectations for firmware and server consumers.

Run the shared-vector check with:

```bash
node scripts/verify-visepod-auth-vector.mjs
```

## Evidence Boundary

- Official Espressif and Waveshare documentation establishes candidate capabilities only.
- Hardware Agent evidence must still prove the purchased board's TLS trust-store behavior, entropy,
  RSA Digital Signature provisioning, locked-key behavior, signing latency, and recovery procedure.
- No downstream Device API, registry, gateway, or firmware implementation may treat this draft as an
  accepted production protocol before Issue #282 receives independent architecture/security review.
- The operator action for physical provisioning and custody remains open in
  [OA-017](../governance/operator-action-register.md).
