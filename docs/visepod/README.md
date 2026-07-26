# VisePod Documentation

Status: draft prototype planning

VisePod is a controlled, physical voice endpoint for the existing VisePanda Copilot. The current
initiative is limited to three to five investor-demonstration devices. It is not a public product,
does not block the Phase 0 Web MVP, and does not authorize production fleet, firmware OTA, sales,
subscription, emergency, medical, or guaranteed-response claims.

## Read In This Order

1. [Investor Prototype Amendment](../planning/visepod-investor-prototype-amendment.md)
2. [Parent Initiative #278](https://github.com/JTCAO515/VP-Final/issues/278)
3. [Positioning Issue #279](https://github.com/JTCAO515/VP-Final/issues/279)
4. The latest architecture decision or protocol Issue named by the parent initiative

The amendment is a draft until the operator and architecture reviewer accept its open decisions.
GitHub Issues remain the live execution queue.

## Frozen Prototype Boundary

- Hardware fact: Waveshare ESP32-S3-Touch-AMOLED-1.8 with Wi-Fi/BLE, touch display, microphone,
  speaker, and no cellular modem.
- Quantity: three to five controlled devices.
- Interaction: push-to-talk, half duplex, visible state, sentence-level text/audio playback.
- Server reuse: existing VisePanda identity, Trip context, Copilot, cost, and telemetry boundaries.
- Device minimization: no provider master key, user profile, Trip, history, or retained raw recording
  on the device.
- Current stage: positioning, network/speech feasibility, and device-threat-model work only.

## Explicit Non-Capabilities

No current document or prototype may imply that VisePod:

- is publicly available or ready for manufacture;
- works without Wi-Fi;
- provides emergency, medical, police, consular, booking, payment, or SLA-backed service;
- continuously listens, uses a wake word, or stores conversation history locally;
- has proven value over a phone and earbuds before the controlled comparison is complete.

## Evidence Rule

Code, animation, a single successful call, or an investor reaction is not product-validation
evidence. Advancement requires the repeatability, comparison, safety, and stop/continue gates in the
prototype amendment. Failed gates stop or reshape the hardware path without changing the Web
Copilot roadmap.
