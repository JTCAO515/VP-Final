# Knowledge Fact Review Runbook

Status: active
Owner: knowledge operator

## Purpose and Trigger

Use weekly, after a material user report, or when facts expire. One reviewed fact may feed Copilot,
Explore, and SEO, so provenance and freshness are release-critical.

## Procedure

1. Open the expired/reported fact queue and group by city, POI, fact type, and user exposure.
2. Check the original source and a current owner/official source when possible.
3. Record source, observed value, confidence, `verifiedAt`, and `expiresAt`.
4. Renew unchanged facts, update changed facts as a new version, or deprecate unsupported facts.
5. Confirm deprecated/expired facts are excluded from public derivation and Copilot retrieval.
6. Link recurring unanswered questions to knowledge gaps and mark resolved only when evidence exists.
7. Sample the resulting Explore/guide/Copilot presentation for misleading wording.

## Verification

- No active fact lacks source, confidence, or verification time.
- No expired/deprecated fact is exposed as current truth.
- Missing evidence results in omission/unknown, not a guessed value.
- Review creates an auditable version/status change.

## Escalation

Safety, entry policy, payment, transport disruption, or widespread exposure requires immediate
deprecation and a D2 review rather than waiting for the weekly queue.
