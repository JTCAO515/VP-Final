# ADR-0016: Execution-Fact Safety and High-Risk Fixed Expressions

Date: 2026-08-11
Status: Accepted
Deciders: independent architecture owner through Issue #344
Decision date: 2026-08-12
Owner: AI and knowledge safety
Issue: [#348](https://github.com/JTCAO515/VP-Final/issues/348)

## Context

VisePanda's execution guidance can be used in front of a driver, restaurant worker, venue staff
member, clinician, or emergency responder. A made-up Chinese address, allergy statement, symptom,
document statement, or emergency request is not merely a low-quality answer: it can cause a
real-world error. Prompt wording alone cannot establish a safety boundary.

[ADR-0006](ADR-0006-knowledge-evidence-and-index-quality.md) already makes reviewed/current facts
the only public or retrieval-eligible knowledge. This ADR proposes the additional output boundary:
the model may not turn missing or unsupported evidence into an executable claim.

## Proposed Decision

### 1. Execution facts require eligible support

An **execution fact** is a specific value a traveler may act on: a destination address, route, line
name, departure/arrival time, fare/price, opening time, or latest-entry time. An AI response MUST NOT
state an execution fact unless the value is tied to a current reviewed fact with an eligible source
class under ADR-0006:

- `official`;
- `operator_verified`; or
- `reputable_editorial`.

The supporting fact MUST have a current review and expiry. `user_report`, `model_output`,
`uncorroborated_scrape`, a stale fact, a missing fact, a citation label without a matching fact value,
or a model inference is not support. When support is absent, the response may state that the value is
unverified, but MUST NOT substitute a plausible value.

### 2. High-risk content requires an operator-verified fixed expression

The following categories MUST use an operator-verified fixed expression. The model MUST NOT freely
author, translate, paraphrase, combine, or fill a high-risk expression from user text or general
knowledge:

1. allergy and dietary restriction;
2. symptoms and medical-care wording;
3. emergency-help wording;
4. passport, visa, and ticket statements; and
5. destination addresses.

The fixed-expression collection, its provenance fields, and its runtime lookup are deliberately out
of scope for this ADR and belong to #349. Any later expression is eligible only while its operator
verification and review date remain current according to the data model accepted in that Issue.

### 3. No fixed expression means honest unavailability

When no eligible fixed expression exists, the product MUST render the category's fixed fallback below.
It MUST NOT replace the fallback with model-authored Chinese, transliteration, an inferred address, or
a more specific claim. A Human Help entry point may be shown only where the existing controlled-preview
policy permits it; this ADR does not promise a person, emergency response, medical care, legal advice,
or a service-level agreement.

| Category | Fixed fallback when no eligible expression exists |
| --- | --- |
| Allergy / dietary restriction | “I can’t safely create a card for this allergy or dietary restriction. Please use a verified card or ask the venue to confirm ingredients before consuming.” |
| Symptoms / medical wording | “I can’t safely create a medical translation for this request. Please contact a qualified clinician or pharmacist; for urgent danger, contact local emergency services.” |
| Emergency help | “I can’t create an emergency request card for this situation. Contact local emergency services, your accommodation, insurer, or consulate as appropriate.” |
| Passport / visa / ticket statement | “I can’t verify or create this document statement. Check with the issuing authority, carrier, venue, or its staff.” |
| Destination address | “I can’t safely provide a destination address. Use an official venue, map, or booking confirmation, or ask the venue to verify the address.” |

### 4. Downstream enforcement is fail-closed

The later pipeline implementation (#350) MUST reject unsupported execution facts and high-risk free
text before presentation. The later eval gate (#351) MUST make those failures visible in CI. No caller,
feature flag, model provider, or fallback model may bypass this decision. Until those controls merge,
new Show to Local or equivalent execution surfaces MUST NOT claim this decision is runtime-enforced.

## Consequences

- #349 must provide provenance, verification, and freshness semantics for fixed expressions without
  weakening ADR-0006's fact-source eligibility.
- #350 must establish the deterministic support/fixed-expression gate at the AI presentation boundary.
- #351 must add mandatory adversarial evals for unsupported addresses, routes, times, prices, and all
  five high-risk categories, including the no-expression fallback.
- Existing generic Copilot answers remain governed by ADR-0006 and current product constraints. This
  ADR does not authorize a new public surface, medical advice, document verification, or Human Help
  capability.

## Rollback and Failure Mode

If a fixed-expression source is withdrawn, expired, conflicting, or unavailable, remove it from
eligibility and show the fixed fallback. Rollback MUST tighten to unknown/unavailable behavior; it
MUST NOT restore free-form generation for a high-risk category.

## Review Gate

This is a D2 safety boundary. It becomes binding only after independent Tier B approval. The approval
must confirm that each fallback is compatible with the Phase 0 Human Help and emergency boundaries,
that ADR-0006 remains the authority for fact eligibility, and that #349–#351 retain their separate
implementation scope.
