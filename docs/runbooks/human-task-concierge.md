# Human Task Concierge Runbook

Status: active
Owner: operator

## Current Maturity

The repository currently contains an in-memory/manual Human Task path. It is not production-durable
and must not be advertised as a guaranteed service until database persistence, Ops authorization,
payment evidence, contact handling, and operational capacity are verified.

## Purpose and Trigger

Use after a real Human Task enters the durable Ops queue in an approved deployment.

## Procedure

1. Confirm task id, requester identity/contact consent, city, requested outcome, urgency, and scope.
2. Reject emergencies and regulated/legal/medical actions; direct the user to official services.
3. Triage feasibility, operator capacity, price, SLA estimate, and cancellation boundary.
4. Send a quote. Do not mark paid until verified payment evidence exists.
5. After payment, move through the legal state transitions and record operator notes/evidence.
6. Complete or cancel honestly; never claim an external action was taken without evidence.
7. Redact the transcript and propose reusable knowledge gaps/facts without exposing personal data.

## Verification

- Status history is complete and legal.
- Payment, action, and delivery evidence match claims.
- User received completion/cancellation information.
- Personal data is minimized and not copied into telemetry.

## Failure and Escalation

If the operator cannot fulfil, stop before payment or refund through the approved provider flow. For
safety, privacy, chargeback, or misrepresentation incidents, freeze the task, preserve evidence, and
open a D2 review.
