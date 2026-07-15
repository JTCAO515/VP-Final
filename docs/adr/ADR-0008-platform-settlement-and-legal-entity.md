# ADR-0008: Platform settlement and legal-entity boundary

Date: 2026-07-15
Status: Draft -- not accepted and not an implementation authorization
Deciders: JTCao (operator), legal/entity owner, finance/tax owner, architecture owner
Owner: operator / commercial architecture
Review date: before Phase 3 is authorized, and no later than the first month with 80 mediated orders

## Context

Phase 3 would introduce platform take rate, settlement to approved service providers or travel
agencies, and limited self-service for an existing whitelist. Those capabilities change who receives
money, which entity contracts with a traveller, how taxes/refunds/disputes are handled, and whether
the platform has KYC/AML or regulated payment obligations.

The frozen product baseline deliberately defers platform-internal split payouts until a legal entity
and a cross-border settlement path are ready. The current Phase 0 controlled preview does not collect
payment, does not promise paid fulfilment, and does not establish a merchant-of-record. No existing
code, Stripe placeholder, partner record, or Human Task state is evidence that these questions have
been decided.

This is a D3 operator/legal decision. It is recorded as a draft now so later implementation cannot
quietly turn a provider API choice into a commercial, tax, or legal decision.

## Decision Boundary

Until this ADR is accepted, the project MUST NOT:

- collect or retain a platform take rate, commission, provider payout balance, reserve, tax amount, or
  settlement instruction;
- present VisePanda as merchant of record, travel seller, escrow holder, payment intermediary, or
  tax withholding agent;
- create Stripe Connect or equivalent connected accounts, transfer funds, onboard providers, or expose
  a provider self-service settlement surface;
- mark a traveller payment as received, a provider as paid, or a commission as earned from a
  placeholder, a manual note, or an unverified webhook;
- infer a legal entity, jurisdiction, tax treatment, KYC/AML duty, refund rule, or take-rate formula
  from a payment provider's product documentation.

Phase 3 code remains trigger-gated: it may begin only after **both** (1) the project reaches at least
100 mediated orders in one month and (2) the operator records the legal-entity decision required by
VP-Codex-Final#169 D4. A documentation draft does not satisfy either trigger.

## Required Acceptance Decisions

The named deciders must explicitly record every item below before changing this ADR to `Accepted`.
Unknown is an allowed answer only when it keeps the related capability disabled.

| Decision | Required answer | Evidence / owner |
| --- | --- | --- |
| Contracting and receiving entity | Legal name, jurisdiction, registration status, merchant-of-record role, and countries it can serve | Operator + qualified legal/tax review |
| Money flow | Whether the platform charges the traveller, invoices an agency, receives a lead fee, or only records an off-platform referral | Operator + finance owner |
| Take rate | Eligible service/order types, gross/net basis, rate/range, currency, disclosure point, reversals, and non-eligibility cases | Operator + commercial owner |
| Settlement provider | Approved provider/rail, supported countries/currencies, account model, payout timing, fees, reserve/negative-balance handling, and failure path | Finance owner + provider agreement |
| Provider eligibility | Whitelist process, identity/KYC/KYB evidence, contract acceptance, sanctions/availability screening where applicable, and suspension rules | Legal/commercial owner |
| Tax and invoicing | Tax nexus, invoice issuer, data required for invoices, withholding/remittance responsibility, and record-retention owner | Qualified tax review |
| Refunds and disputes | Traveller-facing policy, provider responsibility, chargeback/dispute evidence, refund approver, and ledger correction sequence | Legal/operations owner |
| Privacy and access | Minimum settlement data, access roles, retention/deletion rules, export controls, and incident owner | Privacy/security owner |

The acceptance record MUST cite dated source evidence or a signed/operator-approved decision. It MUST
not include secrets, bank details, card data, tax identifiers, or personal provider records.

## Candidate Architecture After Acceptance

This section is a constraint on future design review, not a selected provider or data model.

1. **Ledger before transfer.** Every money-adjacent event must have an immutable ledger record with a
   business reference, amount/currency, lifecycle state, evidence reference, actor, and correction
   linkage. Provider webhooks are evidence inputs; they are not the ledger authority.
2. **Separate obligations.** Traveller charge, platform commission, provider payable, refund,
   chargeback, and tax/invoice obligation must remain distinct records. A single `paid` boolean is
   insufficient.
3. **Verified transitions only.** External payment/settlement callbacks must be authenticated,
   idempotent, replay-safe, and reconciled to a known ledger reference. Client requests and Ops UI
   never write a financial terminal state directly.
4. **Explicit service roles.** The public traveller, approved provider, authorized Ops, finance
   reviewer, and provider webhook each require separate server-side authorization. A valid session
   does not authorize settlement access.
5. **Fail closed.** Missing entity, provider, KYC, tax, or webhook evidence leaves the relevant state
   unavailable or pending. It never falls back to a manual success label.
6. **No public marketplace by default.** P3-03 may expose self-service only to a reviewed whitelist;
   it must not become open provider signup without a later ADR.

## Required Contract Set Before Phase 3 Code

After acceptance, schema-first work must freeze these contracts in separate, reviewable PRs before
any UI or provider adapter consumes them:

- `CommercialOrder`, `PaymentEvidence`, `Commission`, `Settlement`, and `LedgerEntry` lifecycle
  schemas with amount/currency precision and immutable event identifiers;
- allowed transition tables and idempotency keys for charge, refund, dispute, commission, and payout;
- a provider capability interface that returns typed unavailable states and does not expose credentials;
- server-only authorization matrix for provider, Ops, finance, and webhook actors;
- disclosure, invoice, retention, export, audit, and rollback requirements derived from the accepted
  legal/entity decision.

No schema may encode a take-rate percentage, provider, jurisdiction, or settlement instruction until
the accepted decision names it.

## Mapping to Phase 3 Acceptance

| Future issue | May start only when | Additional required proof |
| --- | --- | --- |
| P3-01: platform take rate and ledger | This ADR is accepted and the monthly-order trigger is observed | Ledger/transition schema, disclosure copy, reconciliation and correction tests |
| P3-02: provider settlement | P3-01 contracts are merged; entity/provider/KYC/tax decisions are accepted | Authenticated idempotent callbacks, least-privilege access, payout failure/reversal tests, approved provider evidence |
| P3-03: whitelist self-service | P3-02 controls are operating and the whitelist process is accepted | Provider authorization/BOLA tests, suspension path, audit trail, no-open-signup browser evidence |

## Consequences

- Phase 0 and Phase 1 continue to treat Human Help as controlled-preview triage. P0-17 remains
  separately blocked by the payment route/entity decision and is not accelerated by this draft.
- Affiliate clicks, manual quotes, and future lead fees may be observed only through their existing
  truthful ledgers/policies; none may be relabeled as take-rate revenue.
- The operator must budget for qualified legal/tax/provider review before the Phase 3 trigger is
  acted on. Engineering cannot substitute a payment SDK integration for that review.

## Rollback and Retirement

If an accepted route becomes unavailable, legally unsuitable, or operationally unsafe, freeze new
charges/payouts for the affected corridor, preserve immutable evidence, expose an honest unavailable
state, and open a D2/D3 review. Do not delete ledger evidence, bypass reconciliation, or route funds
through a different provider without a superseding ADR.

## Acceptance Record

- 2026-07-15: draft created to make the Phase 3 legal/commercial gate explicit. No legal entity,
  take rate, provider, tax treatment, or settlement route has been selected.
- Pending: operator decision for VP-Codex-Final#169 D4, qualified legal/tax review, Phase 3 monthly
  mediated-order trigger, architecture review, and an append-only acceptance update.
