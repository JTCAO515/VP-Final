# Phase 0 Public Legal and Trust Baseline

Status: accepted

Owner: operator / compliance

Effective date: 2026-07-24

Decision source: GitHub Issue #75 and the operator-approved D3 baseline recorded there

## Purpose

This constraint defines the claims that VisePanda may publish during the Phase 0 controlled preview.
It is the source for the Privacy Policy, Terms of Use, Affiliate Disclosure, Human Help Disclaimer,
and Emergency Disclaimer. It is not legal advice and does not replace review by qualified counsel
before the product, processing footprint, payment route, or jurisdictional reach materially changes.

## Approved Operator Facts

- Operator and data controller: 广州创竞科技有限公司, Guangzhou, China.
- Privacy and support contact: `admin@go2china.space`.
- Minimum user age: 16.
- Policy effective date: 2026-07-24.
- Current named processors: Vercel, Supabase, Upstash, DashScope/Qwen, DeepSeek, Moonshot/Kimi,
  and Zhipu/GLM.
- Processing can occur outside a traveler's home location. No unimplemented cross-border transfer
  mechanism may be claimed.

## Privacy Boundary

Public copy may describe account identity and email, signed anonymous/session identifiers, messages
and Trip content, Human Help request/contact details, model usage/cost metadata, product/security
events, and necessary network/device operational metadata. It must state purpose and minimization.

An access, correction, or deletion request is sent from the account email to
`admin@go2china.space` with subject `VisePanda Data Deletion Request`. VisePanda acknowledges within
7 calendar days and aims to remove eligible data from active systems within 30 calendar days, or
sooner when law requires. Identity verification must use the minimum necessary information. Lawful,
security, dispute, fraud-prevention, or immutable accounting exceptions must be explained.

The product has no verified self-service deletion control. Public copy must not claim one. Until the
#248 retention implementation and production purge controls are independently verified, public copy
must not promise the internal 400-day cost-record period or another precise all-record duration.

## Affiliate Boundary

VisePanda may receive commission from an eligible partner action. A commercial action must disclose
that relationship before or adjacent to the action and must use the governed outbound gateway. A
click is not revenue, a booking, or proof of settlement. Ordinary planning content must not carry an
undisclosed commercial action.

## Human Help Boundary

The binding controlled-preview boundary remains:

- Shanghai only;
- English requests;
- 09:00–21:00 China Standard Time, daily;
- no more than five new requests per operating day;
- manual best-effort triage with no guaranteed response or SLA;
- no payment and no claim of booking, purchase, or task completion;
- not an emergency, medical, police, fire, legal, immigration, payment, account-access, insurance,
  or consular service.

The public intake must link to the full Human Help limits and emergency guidance. It must not imply
that submission creates paid work or a guaranteed outcome.

## Emergency Boundary

VisePanda does not monitor or dispatch emergency assistance. Public guidance directs an urgent user
to official local help and may list the verified mainland numbers: police 110, fire 119, medical
emergency 120, and traffic accident police 122. It must not promise English-language availability.
The public page links to the official Shanghai government reference used for verification.

## Prohibited Public Claims

The controlled preview must not claim:

- an exclusive governing law, court, or forum without separate qualified legal review;
- a guaranteed Human Help response, completion, availability, or SLA;
- payment collection, renewal, subscription, refund, or charge handling;
- emergency, medical, police, fire, legal, immigration, or consular service;
- a self-service account/data deletion mechanism that does not exist;
- precise retention enforcement that has not passed production evidence;
- a third-party booking, price, inventory hold, refund, or performance guarantee.

## Change Control

Any change to the operator, contact, processors, collected data classes, retention promise, age,
payment state, affiliate behavior, Human Help scope, emergency guidance, or dispute terms is D3 or
higher. It requires an explicit operator decision, synchronized updates to public pages and this
baseline, tests for prohibited claims, and independent review before merge. Code or copy may not
silently widen the service boundary.
