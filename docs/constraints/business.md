# Business Constraints

Status: active

## Trust Before Monetization

- Copilot MUST NOT inject commercial actions into ordinary planning or advice responses.
- Commercial actions MUST be tied to explicit commercial intent and carry a clear disclosure.
- Raw partner URLs MUST NOT be rendered; redirects MUST use the outbound gateway and create evidence.
- Pending or inactive partners MUST NOT appear as available to public users.
- Missing inventory, price, commission, rating, booking state, or partner capability MUST be shown as
  unknown or unavailable.

### China Readiness Check

The China Readiness Check is an explainable preparation diagnostic, not a score or recommendation
engine. It MUST use only versioned deterministic rules; it MUST preserve missing answers as
`unknown`; and it MUST distinguish self-reported information from externally verified facts.
Readiness schema and derivation MUST NOT emit, rank, or imply an affiliate action. A later UI
consumer may show a partner action only after it has confirmed matching explicit user intent and an
active approved partner through the existing outbound controls.

### Rescue Mode

Rescue Mode MUST use deterministic category routing and MUST NOT use an LLM as its sole safety
router. A route whose reviewed target is absent MUST be shown as unavailable, never as successful.
Health and safety escalation MUST go to the official emergency boundary first and MUST NOT offer
Human Help. Human Help may be offered only from real, matching operational configuration for city,
category, hours, and a named owner; it remains best-effort with no SLA and requires a separate user
confirmation before any task submission.

## Human Help and Payments

- Human Help MUST require user confirmation before task creation or payment.
- Human Help MUST follow the accepted [controlled-preview launch policy](../commercial/human-help-launch-policy.md).
- During the controlled preview, a verified traveler MAY create at most one new Human Help request per
  China day. A safe replay of the same idempotency key returns the original request and MUST NOT consume
  another slot; a distinct same-day request MUST receive an honest availability response, not a fake
  receipt or a promise of tomorrow's service.
- A Human Help request MUST NOT be represented as accepted work, a guaranteed response, a booking,
  an emergency service, or a paid service before its policy and durable implementation gates are met.
- Human Task UI MUST distinguish request, quote, payment pending, paid, fulfilling, done, and cancelled.
- A payment provider response or verified webhook is required before marking a task paid.
- Placeholder purchase UI MUST say it is a placeholder and MUST NOT simulate a completed purchase.
- Real-world services use the accepted external payment route; digital entitlements use the accepted
  platform-compliant route. A route change requires an ADR and legal review.

## Commercial Measurement

- Money-adjacent features MUST define a ledger or telemetry event and an owner.
- Revenue claims MUST be derived from payment/partner evidence, never click estimates alone.
- New monetization work MUST state conversion hypothesis, user trust risk, cost, disclosure, and
  rollback before implementation.
