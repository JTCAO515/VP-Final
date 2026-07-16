# Knowledge Fact Review Runbook

Status: active
Owner: knowledge operator

## Purpose and Trigger

Use weekly, after a material user report, or when facts expire. One reviewed fact may feed Copilot,
Explore, and SEO, so provenance and freshness are release-critical.

## Procedure

1. Open the expired/reported fact queue and group by city, POI, fact type, and user exposure.
2. Check the original evidence and a current independent source. Classify it as `official`,
   `operator_verified`, `reputable_editorial`, `user_report`, `model_output`, or
   `uncorroborated_scrape`.
3. Record the stable source URL/internal locator, a maximum-240-character summary of exactly what it
   supports, confidence, and `expiresAt`. Do not include email, phone, prompts, or private transcripts.
   The system records `ingestedAt`; do not copy that value into `verifiedAt`.
4. Save the fact as `draft`. Inspect the saved value and evidence, then use the separate review action.
   That action records the real `verifiedAt`. User reports, model output, and uncorroborated scrapes
   must first be independently checked and reclassified; changing status alone is forbidden.
5. Renew unchanged reviewed facts, save changed facts as a new draft version for re-review, or
   deprecate/reject unsupported facts. Never treat a legacy `source` or `active` label as evidence.
6. Confirm draft/deprecated/expired facts are excluded from public derivation and Copilot retrieval.
7. Link recurring unanswered questions to knowledge gaps and mark resolved only when evidence exists.
8. Sample the resulting Explore/guide/Copilot presentation for misleading wording.

## Verification

- No reviewed fact lacks an eligible source class, locator, evidence summary, confidence, or real
  verification time.
- Draft ingestion time is not presented as verification time.
- No expired/deprecated fact is exposed as current truth.
- Missing evidence results in omission/unknown, not a guessed value.
- Review creates an auditable version/status change.

## Escalation

Safety, entry policy, payment, transport disruption, or widespread exposure requires immediate
deprecation and a D2 review rather than waiting for the weekly queue.
