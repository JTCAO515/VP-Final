# Human Task Concierge Runbook

Status: active
Owner: operator

The binding service boundary is the [Human Help controlled-preview policy](../commercial/human-help-launch-policy.md).
Use its city, language, hours, capacity, exclusions, and target wording before handling a request.

## Current Maturity

The repository contains durable owner-scoped intake and an authorized, audited transition API.
Controlled-preview triage and cancellation are implemented, but paid fulfilment must not be
advertised until payment evidence, contact handling, capacity, and remaining operator actions are
verified.

## Purpose and Trigger

Use after a real Human Task enters the durable Ops queue in an approved deployment.

## Procedure

1. Confirm the request is within the policy's Shanghai/English/window/capacity envelope before collecting more information.
2. Confirm task id, requester identity/contact consent, city, requested outcome, urgency, and scope.
3. Reject emergencies and regulated/legal/medical actions; direct the user to official services.
4. Triage feasibility, operator capacity, response target, and cancellation boundary. Record a
   10-500 character reason when moving `requested -> triaged`; state that targets are not guarantees.
5. During controlled preview, do not send a payment link or accept paid fulfilment. A future approved payment flow is required before using `quoted` or later payment states.
6. After verified payment exists in a future approved flow, move through the legal state transitions and record operator notes/evidence.
7. During preview, cancel only through the governed endpoint and record why work did not proceed.
   Cancelled tasks cannot be reopened; a genuine new request requires a new task. Complete future
   paid work honestly and never claim an external action was taken without evidence.
8. Redact the transcript and propose reusable knowledge gaps/facts without exposing personal data.

## Verification

- Status history is complete and legal.
- Payment, action, and delivery evidence match claims.
- User received completion/cancellation information.
- Personal data is minimized and not copied into telemetry.

## Failure and Escalation

If the operator cannot fulfil, stop before payment or refund through the approved provider flow. For
safety, privacy, chargeback, or misrepresentation incidents, freeze the task, preserve evidence, and
open a D2 review.
