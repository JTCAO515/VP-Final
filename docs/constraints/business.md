# Business Constraints

Status: active

## Trust Before Monetization

- Copilot MUST NOT inject commercial actions into ordinary planning or advice responses.
- Commercial actions MUST be tied to explicit commercial intent and carry a clear disclosure.
- Raw partner URLs MUST NOT be rendered; redirects MUST use the outbound gateway and create evidence.
- Pending or inactive partners MUST NOT appear as available to public users.
- Missing inventory, price, commission, rating, booking state, or partner capability MUST be shown as
  unknown or unavailable.

## Human Help and Payments

- Human Help MUST require user confirmation before task creation or payment.
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
