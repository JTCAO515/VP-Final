# Commercial Documentation

Commercial docs define how VisePanda tracks money, partner intent, and paid human work.
Implementation must follow the baseline rule: anything money-adjacent needs a ledger or explicit
telemetry plan.

## Current Revenue Lines

| Line                    | Current state                                              | Required tracking                                      |
| ----------------------- | ---------------------------------------------------------- | ------------------------------------------------------ |
| Outbound affiliate      | Gateway and click ledger skeleton                          | `outbound_clicks` + telemetry                          |
| Human Task              | Durable controlled-preview intake; no quote or payment yet | `human_tasks` receipt + future state/payment ledger    |
| Trip Pass               | Not active                                                 | Entitlement + purchase/restore ledger when implemented |
| Custom quote / lead fee | Not active                                                 | Quote object + partner/agency ledger when implemented  |

## Human Help Controlled Preview

The binding service boundary is the [Human Help controlled-preview policy](human-help-launch-policy.md).
It permits only manual Shanghai/English triage within a limited operating window and capacity. It does
not authorize payment collection, an SLA guarantee, emergency support, or third-party outcome claims.
Future task, payment, and public-copy work must implement that policy rather than infer a service
promise from the existing placeholder UI.

## Public Legal and Trust Baseline

The [Phase 0 public legal and trust baseline](phase-0-public-legal-baseline.md) binds the operator
facts, privacy request process, affiliate disclosure, Human Help limits, emergency boundary, and
prohibited public claims used by the five public trust pages. Changes to those facts or promises
require an explicit operator decision and independent review; UI copy cannot widen them on its own.

## Payment Routing Notes

- Human Task is a real-world service. Stripe external payment is expected once merchant-of-record
  details are decided.
- Trip Pass is a digital entitlement. Mobile implementation must account for Apple IAP rules.
- Until payment routing is final, public and Ops surfaces must not expose quote/payment controls or
  claim payment collection.

## Partner Rules

- Partner links go through `/outbound`.
- Allowed hosts must be configured before links are shown.
- Disclosure copy is required near commercial actions.
- Commission assumptions are not revenue until settlement data exists.
