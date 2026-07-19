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
   That action records the real `verifiedAt`, authenticated Ops reviewer privately, versioned cadence,
   bounded expiry, and append-only completion audit in one transaction. User reports, model output,
   and uncorroborated scrapes
   must first be independently checked and reclassified; changing status alone is forbidden.
5. Renew unchanged reviewed facts, save changed facts as a new draft version for re-review, or
   deprecate/reject unsupported facts. Never treat a legacy `source` or `active` label as evidence.
6. Confirm draft/deprecated/expired facts are excluded from public derivation and Copilot retrieval.
7. Link recurring unanswered questions to knowledge gaps and mark resolved only when evidence exists.
8. Sample the resulting Explore/guide/Copilot presentation for misleading wording.

## Bulk Collection Import

1. Start from the header-only six-city collection template. Do not add columns or use spreadsheet
   formulas that can silently change JSON/date fields.
2. Give every importable row a unique `collection_row_id`, a stable POI source identity, researcher
   handle, typed source metadata, and a JSON-object fact value. `reviewed` rows additionally require
   a separate reviewer handle and real `verified_at` time. Do not use import time as verification time.
3. Submit `mode: dry-run` through the protected Ops endpoint and resolve every reported error. A
   `missing`, `conflict`, or `rejected` collection row is intentionally skipped, not proof of a fact.
4. Submit the identical corrected file with `mode: commit`. The response must report zero errors;
   inspect created, merged, skipped, and duplicate counts. Save only the sanitized report, never raw
   research notes in public issue comments.
5. Confirm newly imported facts remain drafts. Use the normal explicit review action before expecting
   Copilot, Explore, or SEO to consume a fact. A repeated unchanged upload must report duplicates and
   create no new records.

## Verification

- No reviewed fact lacks an eligible source class, locator, evidence summary, confidence, or real
  verification time.
- Draft ingestion time is not presented as verification time.
- No expired/deprecated fact is exposed as current truth.
- Missing evidence results in omission/unknown, not a guessed value.
- Review creates an auditable version/status change.
- Review expiry does not exceed the policy maximum: 30 days for volatile execution facts, 180 days
  for `rainy_fit`, and 90 days for all other or unknown fact types.
- Public responses may expose `reviewPolicy` and freshness dates, but never reviewer identity.

## Escalation

Safety, entry policy, payment, transport disruption, or widespread exposure requires immediate
deprecation and a D2 review rather than waiting for the weekly queue.
