# Human Help Controlled Preview Policy

Status: accepted controlled-preview policy; merged and implemented by the P0-13 intake boundary
Owner: JTCao (operations owner)  
Effective for: controlled preview only  
Review date: 2026-08-14 or before any public paid launch, whichever is earlier

## Purpose and Authority

This policy turns DOC-P0-04 / OA-007 into a narrow, auditable operating boundary for Human Help.
The operator delegated the initial baseline to the delivery agent on 2026-07-14. It is a product and
operations policy, not legal advice and not approval to collect payments or advertise a public SLA.

The policy governs future Human Task UI, state transitions, Ops handling, telemetry, and public copy.
It does not override privacy, payment, permission, or deployment constraints. If a later legal,
commercial, or safety decision conflicts with this document, pause the affected capability and record
the replacement decision before resuming.

## Launch Envelope

| Dimension         | Controlled-preview baseline                   | Boundary                                                                                                  |
| ----------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| City              | Shanghai only                                 | Requests for another city are declined or redirected to self-service guidance.                            |
| Traveler language | English                                       | The operator may use Chinese internally; this is not a promise of support in any other traveler language. |
| Operating window  | 09:00-21:00 China Standard Time, seven days   | Outside-window requests may be queued; no immediate reply is promised.                                    |
| Capacity          | Maximum five new requests per operating day   | Stop accepting new requests when capacity is reached. Never silently queue paid work.                     |
| Fulfilment owner  | JTCao or a named, authorized on-duty operator | No contractor, guide, or partner may receive task details without a documented authorized workflow.       |

## Supported Work

Human Help is best-effort travel coordination, not a booking, emergency, professional-advice, or
payment service. The controlled preview may triage these task kinds:

| Domain task kind   | Allowed preview work                                                                                                       | Required user confirmation                                                                       |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `call_restaurant`  | Call to ask about hours, availability, dietary accommodation, or a reservation request.                                    | Confirm the venue, date, party size, contact details, and that availability is not guaranteed.   |
| `ticket_help`      | Explain an official booking path, check publicly available ticket information, or ask a venue about ordinary availability. | Confirm attraction, date, traveller eligibility, and that VisePanda does not hold inventory.     |
| `translation_help` | Translate or relay a short travel-related message; clarify a routine service conversation.                                 | Confirm the exact message and intended recipient.                                                |
| `transport_help`   | Explain a route, local transport options, or how to use a third-party transport service.                                   | Confirm origin, destination, timing, and that VisePanda will not place rides or access accounts. |
| `other`            | Triage only. It may be declined, reframed into a supported task, or routed to official/self-service guidance.              | No fulfilment begins without a newly confirmed supported scope.                                  |

## Exclusions and Safety Boundary

The operator MUST decline, stop, or redirect the following. The product MUST NOT imply that Human Help
can perform them.

- Emergency response, personal safety intervention, police, fire, ambulance, or 24/7 rescue. Direct
  the traveller to local emergency services, their insurer, accommodation, embassy/consulate, or a
  qualified local professional as appropriate.
- Medical, legal, visa, immigration, tax, investment, payment-card, or insurance advice.
- Holding cash, making payments, accepting card/passport/account credentials, receiving OTPs, logging
  into a traveller account, or acting as a financial intermediary.
- Guaranteed booking, ticket purchase, inventory hold, visa outcome, transport arrival, or third-party
  service quality. A third party remains responsible for its own availability and service.
- Requests that are unlawful, discriminatory, unsafe, abusive, sexual, or outside the approved city,
  language, time, or capacity envelope.

When declining, give a brief truthful reason and an appropriate official or self-service next step.
Do not invent emergency contacts, availability, prices, or external actions.

## Response and Fulfilment Targets

- **Acknowledgement target:** within four operating hours.
- **Triage or quote target:** within one operating day after receiving sufficient information.
- **Fulfilment target:** agreed case-by-case after triage; no global fulfilment time is promised.

All targets are targets, not guarantees. Capacity, venue response, traveller completeness, third-party
availability, and safety review can delay or prevent fulfilment. User-facing copy MUST use “target” or
“we will review,” never “guaranteed,” “instant,” or “24/7.”

## Pricing, Payment, Cancellation, and Disputes

### Controlled-preview pricing

- No fixed public price, urgent surcharge, subscription entitlement, or prepaid credit is offered.
- A request is free to submit for triage. Submission is not acceptance of work and creates no service
  agreement.
- The operator may prepare a manual, non-binding quote only after scope and capacity are confirmed.
- No paid fulfilment, payment link, or payment-pending state may be exposed until P0-17, the payment
  route/entity decision, and a verified payment provider flow are accepted. OA-006 being skipped does
  not authorize a workaround.

### State mapping

| Task state        | Policy meaning                                               | Operator rule                                                                    |
| ----------------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `requested`       | User submitted a triage request.                             | Acknowledge or decline; do not promise fulfilment.                               |
| `triaged`         | Scope, safety, capacity, and data sufficiency were reviewed. | Record supported/declined decision and reason.                                   |
| `quoted`          | A non-binding proposed price/scope exists.                   | Only available after a future approved payment route.                            |
| `payment_pending` | Awaiting verified provider payment.                          | Not used during controlled preview.                                              |
| `paid`            | Provider payment evidence verified.                          | Not used until P0-17 is accepted.                                                |
| `fulfilling`      | Operator is performing approved, paid work.                  | Record only truthful actions and evidence.                                       |
| `done`            | Agreed work outcome was communicated.                        | Record what was done, what remains third-party dependent, and user notification. |
| `cancelled`       | Work did not proceed or stopped.                             | Record initiator, reason, and any applicable refund outcome.                     |

### Future paid-service rules

Before P0-17 enables payments, the policy for post-payment cancellation, operator failure, third-party
failure, refund, and disputes MUST be reviewed with the actual payment provider, legal receiving
entity, and applicable consumer-protection requirements. Until then, the only safe rule is: do not
accept payment and do not claim a refund process exists.

## Data, Access, and Escalation

### Data minimization

Collect only city, task kind, task description, and one user-selected reply channel. Prefer email.
Do not request passports, payment details, account passwords, OTPs, full travel-document numbers,
medical records, or unnecessary location history.

### Access and retention

- Only the requester and authorized Ops roles may access a task. Authorization must use the accepted
  server-side RBAC path, never email allowlists or client metadata.
- P0-15 task detail requires the explicit `task.contact.read` permission. Internal operator-note
  writes require `task.write`; the server stores the note on the private task and atomically appends
  an audit event containing only actor, task id, timestamp, and whether a note exists. The audit event
  must not duplicate the note, request description, contact details, cookie, signature, or credential.
- P0-16 private evidence may be appended only after `done` or `cancelled` while the retention deadline
  is current. Contact data is redacted before storage; credential, OTP, payment-card, and
  travel-document content is rejected. Evidence follows task deletion and never enters telemetry or
  public responses. An evidence-derived gap is a sanitized open draft, not a fact or publication.
- Routine telemetry must contain event metadata only, not task descriptions, contacts, transcripts, or
  payment evidence.
- Durable task data carries a 90-day retention deadline only after `done` or `cancelled`; a restricted
  purge routine enforces deletion once that deadline arrives. P0-14 assigns the deadline for enabled
  terminal transitions. Production purge scheduling remains unverified, so automated deletion is not
  claimed operational until the registered operator action is complete.

### Escalation

JTCao is the initial escalation owner for safety, privacy, complaint, chargeback, or
misrepresentation incidents. The operator must freeze the task, preserve only necessary evidence,
avoid further external action, notify the traveller honestly, and open a D2 review. Any suspected data
incident pauses Human Help intake until the owner records the corrective action.

## Required Product Copy

Before public exposure, the Human Help surface must state all of the following in plain language:

1. Availability is limited to Shanghai, English, and the stated operating window/capacity.
2. A request is reviewed manually and does not guarantee a reply, booking, or third-party outcome.
3. Human Help is not emergency, medical, legal, payment, or account-access support.
4. Prices and payment are unavailable until an approved quote and verified payment path exist.
5. The user must confirm scope before any future paid work begins.

Existing placeholder/manual UI is not evidence that these disclosures are implemented. P0-13 through
P0-17 must use this policy verbatim or update this document in the same change.

## Measurements and Review

Review weekly during controlled preview: request count, capacity rejections, acknowledgement time,
triage time, decline reasons, complaints, privacy incidents, and any claim that an operator or third
party acted. Do not convert these into revenue or SLA claims without durable evidence.

Narrow city, hours, task types, or capacity immediately if the targets are missed or an incident
occurs. Any expansion requires a documented policy revision, updated public copy, a named fulfilment
owner, and a new review date.

## Acceptance Record

- 2026-07-14: initial conservative controlled-preview baseline established under the operator's
  delegated OA-007 instruction.
- 2026-07-16: P0-13 durable owner/idempotency/capacity intake boundary implemented for review.
- 2026-07-20: P0-15 authorized task detail, minimized internal-note persistence, PII-free note audit,
  and controlled-preview triage UI implemented for review. Quote, payment, assignment, and paid
  fulfilment controls remain unavailable.
- 2026-07-20: P0-16 private terminal evidence and sanitized evidence-to-gap proposal boundary
  implemented for review. No transcript is public and no fact is automatically created or reviewed.
- Required before a public paid launch: payment/entity/legal decision, verified provider integration,
  durable task controls, public-copy implementation, and a fresh policy review.
