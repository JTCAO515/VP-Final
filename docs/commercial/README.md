# Commercial Documentation

Commercial docs define how VisePanda tracks money, partner intent, and paid human work.
Implementation must follow the baseline rule: anything money-adjacent needs a ledger or explicit
telemetry plan.

## Current Revenue Lines

| Line | Current state | Required tracking |
|---|---|---|
| Outbound affiliate | Gateway and click ledger skeleton | `outbound_clicks` + telemetry |
| Human Task | Manual quote flow; operator may attach payment link | `human_tasks` status trail + future payment ledger |
| Trip Pass | Not active | Entitlement + purchase/restore ledger when implemented |
| Custom quote / lead fee | Not active | Quote object + partner/agency ledger when implemented |

## Human Help Controlled Preview

The binding service boundary is the [Human Help controlled-preview policy](human-help-launch-policy.md).
It permits only manual Shanghai/English triage within a limited operating window and capacity. It does
not authorize payment collection, an SLA guarantee, emergency support, or third-party outcome claims.
Future task, payment, and public-copy work must implement that policy rather than infer a service
promise from the existing placeholder UI.

## Payment Routing Notes

- Human Task is a real-world service. Stripe external payment is expected once merchant-of-record
  details are decided.
- Trip Pass is a digital entitlement. Mobile implementation must account for Apple IAP rules.
- Until payment routing is final, PRs may implement manual quote placeholders but must not claim
  real payment collection.

## Partner Rules

- Partner links go through `/outbound`.
- Allowed hosts must be configured before links are shown.
- Disclosure copy is required near commercial actions.
- Commission assumptions are not revenue until settlement data exists.
