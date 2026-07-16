# Six-City Knowledge Expansion Plan

Date: 2026-07-16  
Status: Proposed execution baseline for Phase 1  
Owner: Knowledge operations  
Review gate: before V2-75 bulk import implementation

## Objective

Expand VisePanda's evidence-backed POI knowledge from the current Beijing and Shanghai seed to six
cities without trading trust for row count. The target is a reviewable collection backlog, not a claim
that the POIs or facts already exist.

Cities: Beijing, Shanghai, Chengdu, Guangzhou, Shenzhen, and Xi'an. Every city covers the five
canonical categories: `food`, `attraction`, `hotel`, `shopping`, and `experience`.

## Non-goals

- This plan does not select, rank, recommend, or publish any POI.
- It does not import facts, create production records, or change the knowledge schema.
- It does not infer ratings, prices, foreign-card acceptance, language support, or booking rules.
- It does not treat model output, scraped snippets, or user reports as reviewed evidence.
- It does not make Phase 1 launch-ready claims from coverage targets alone.

## Expansion gates

The work moves through four gates. A city/category cannot skip a gate.

| Gate                 | Required evidence                                                               | Exit condition                                      |
| -------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------- |
| G0 Contract ready    | Fact lifecycle and evidence fields can represent the collection record honestly | Import contract test passes                         |
| G1 Candidate set     | Named POIs have a stable identity and at least one retained source locator      | Candidate count reaches launch minimum              |
| G2 Evidence complete | Required fact types meet the category coverage floor                            | Missing cells remain explicitly `missing`           |
| G3 Reviewed          | Independent editor checks source, wording, confidence, freshness, and conflicts | Only current `reviewed` facts are consumer-eligible |

G0 currently has one open deviation: ADR-0006 requires source class, source locator, and evidence
summary, while the durable `poi_facts` schema exposes one `source` string and requires `verified_at`
even for a draft. V2-75 MUST NOT flatten these meanings or invent a verification timestamp. The
contract correction is a prerequisite for bulk import, not for this planning artifact.
The corrective contract work is tracked in GitHub Issue #230.

## POI quantity targets

Each city has a quality-gated target of 50 POIs and a launch minimum of 30. The minimum is six POIs
per category; it prevents one popular category from hiding an empty execution surface. A city is not
launch-ready merely because it reaches 30 candidates: G2 and G3 must also pass.

| Category   | Target per city | Launch minimum | Why this shape                                                      |
| ---------- | --------------: | -------------: | ------------------------------------------------------------------- |
| Food       |              15 |              6 | Highest-frequency execution questions and language/payment friction |
| Attraction |              12 |              6 | Booking, identity-document, crowd, and opening-hour risk            |
| Hotel      |               8 |              6 | Foreign-guest eligibility and check-in execution risk               |
| Shopping   |               7 |              6 | Payment, tax-refund, return-policy, and access questions            |
| Experience |               8 |              6 | Booking, language, duration, and cancellation uncertainty           |
| **Total**  |          **50** |         **30** | **300 target POIs across six cities**                               |

The machine-readable city/category matrix is
[`six-city-knowledge-coverage-targets.csv`](six-city-knowledge-coverage-targets.csv).

## Required fact coverage

Coverage is calculated only from current, independently reviewed facts:

```text
coverage(category, fact_type) =
  POIs in category with at least one eligible fact of fact_type
  / candidate POIs in category
```

Draft, expired, deprecated, rejected, source-less, future-dated, or conflicted facts do not count.

| Category   | Required fact type          | Minimum coverage |
| ---------- | --------------------------- | ---------------: |
| Food       | `payment_acceptance`        |              80% |
| Food       | `metro_access`              |              80% |
| Food       | `english_menu`              |              60% |
| Food       | `reservation_helpful`       |              60% |
| Food       | `opening_hours`             |              80% |
| Attraction | `booking_required`          |             100% |
| Attraction | `passport_requirement`      |             100% |
| Attraction | `metro_access`              |              90% |
| Attraction | `crowd_pattern`             |              75% |
| Attraction | `opening_hours`             |              90% |
| Hotel      | `foreign_guest_eligibility` |             100% |
| Hotel      | `check_in_requirements`     |             100% |
| Hotel      | `payment_acceptance`        |             100% |
| Hotel      | `metro_access`              |              85% |
| Hotel      | `english_support`           |              75% |
| Shopping   | `payment_acceptance`        |              90% |
| Shopping   | `metro_access`              |              80% |
| Shopping   | `tax_refund`                |              70% |
| Shopping   | `opening_hours`             |              90% |
| Shopping   | `return_policy`             |              60% |
| Experience | `booking_required`          |              90% |
| Experience | `language_support`          |              80% |
| Experience | `duration`                  |              90% |
| Experience | `metro_access`              |              75% |
| Experience | `cancellation_policy`       |              75% |

These are collection requirements, not permission for consumers to interpret new fact types. A fact
type needs an explicit consumer mapping before it can produce a Copilot claim, Explore label, or SEO
sentence.

## Source and evidence rules

### Allowed source classes

| Source class            | Collection use                                     | Public eligibility after review               |
| ----------------------- | -------------------------------------------------- | --------------------------------------------- |
| `official`              | Government, venue, operator, or first-party policy | Eligible while current                        |
| `operator_verified`     | Direct call, visit, or retained correspondence     | Eligible with expiry                          |
| `reputable_editorial`   | Named publication with a stable locator            | Eligible with conservative wording and expiry |
| `user_report`           | Gap discovery only                                 | Ineligible until independently verified       |
| `model_output`          | Research lead only                                 | Never evidence                                |
| `uncorroborated_scrape` | Research lead only                                 | Ineligible until independently verified       |

`source_locator` must be a stable URL or retained internal evidence reference. `evidence_summary` must
state exactly what the source supports in at most 240 characters and contain no contact, payment, or
other personal data. A search-result snippet is not a source locator.

### Confidence rubric

| Confidence | Meaning                                               |
| ---------: | ----------------------------------------------------- |
|       1.00 | Current official source directly states the fact      |
|       0.90 | Direct operator verification with retained evidence   |
|       0.80 | Two independent reputable sources agree               |
|       0.70 | One reputable source, conservatively worded           |
|     < 0.70 | Research lead only; keep out of reviewed/public state |

Confidence is evidence strength, not model certainty or editor intuition.

### Verification and expiry

- `verified_at` is the time an editor checked the evidence, never the source publication date and
  never the import time for an unreviewed draft.
- Dynamic operating facts (`opening_hours`, payment, menu, booking, cancellation, tax refund) expire
  after at most 90 days.
- Access and eligibility facts (metro, foreign-guest eligibility, check-in requirements, language
  support) expire after at most 180 days.
- Structural identity and geolocation evidence expires after at most 365 days unless an accepted
  policy explicitly permits a longer interval.
- `expires_at = null` is reserved for facts that an editor has classified as stable and justified in
  `review_notes`; it is not a convenience default.
- Conflicting evidence is recorded as `collection_status=conflict`, withheld from import, and routed
  to an independent reviewer.

## Collection template

Use [`six-city-poi-fact-collection-template.csv`](six-city-poi-fact-collection-template.csv). It is
header-only by design: no sample POI, source, confidence, or timestamp is presented as real evidence.

Required collection states:

- `missing`: evidence has not been found; fact fields remain blank.
- `researched`: evidence is retained but has not been independently reviewed.
- `conflict`: sources disagree; no public fact may be created.
- `reviewed`: an independent editor completed source, confidence, freshness, and wording checks.
- `rejected`: evidence is inadequate or the candidate is outside scope.

The CSV contains both current storage fields and ADR-required collection fields. Until G0 closes,
`source_class`, `source_locator`, and `evidence_summary` are collection-only and MUST NOT be silently
discarded during import.

## Editorial schedule

The schedule is capacity-gated. Dates are set only when an owner accepts a wave.

| Wave | Scope                                          | Exit evidence                                                     | Dependency          |
| ---- | ---------------------------------------------- | ----------------------------------------------------------------- | ------------------- |
| 0    | Contract correction and importer dry-run rules | G0 contract tests; zero fabricated timestamps                     | Before V2-75        |
| 1    | Beijing + Shanghai baseline audit              | Coverage report for all five categories; legacy seed reviewed     | Wave 0              |
| 2    | Chengdu + Xi'an collection                     | Candidate and missing-data report; independent review sample      | Wave 1 quality gate |
| 3    | Guangzhou + Shenzhen collection                | Candidate and missing-data report; independent review sample      | Wave 2 quality gate |
| 4    | Six-city correction pass                       | Expiry queue, conflict rate, correction rate, consumer spot-check | Waves 1-3           |

Each wave uses two roles: researcher and independent reviewer. One person may hold both roles only on
different records and with the review action logged. If staffing cannot support this separation, the
facts remain draft.

## Quality reporting

Report these measures per city and category after every wave:

- candidate POIs versus target and launch minimum;
- eligible reviewed facts versus required coverage;
- explicit missing cells;
- conflicts awaiting resolution;
- facts expiring in 30 days;
- correction and rejection rates;
- consumer mapping coverage for collected fact types.

Raw row count is not a success metric. The release decision uses eligible coverage and observed
correction/staleness rates.

## Import handoff for V2-75

The future bulk importer must:

1. dry-run every row through schema and controlled-vocabulary validation;
2. reject unknown city/category/fact-type values instead of coercing them;
3. preserve source class, locator, evidence summary, reviewer, and review time;
4. never synthesize missing values or verification timestamps;
5. create drafts by default and require an explicit review transition;
6. detect duplicate POI identities and duplicate fact versions;
7. emit imported, skipped, conflicted, and rejected counts;
8. be idempotent when the same collection row is replayed.

No import implementation begins until the G0 contract deviation has an accepted resolution.
