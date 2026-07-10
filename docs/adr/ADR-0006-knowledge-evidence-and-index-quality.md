# ADR-0006: Knowledge evidence and index quality

Date: 2026-07-11
Status: Accepted
Deciders: JTCao (operator) / architecture owner
Owner: JTCao (operator and architecture owner)
Review date: before P0-08 (#117) merges, and no later than 2026-08-11

## Context

Copilot citations, Explore facts, and SEO pages share one knowledge asset. The project already requires
source, confidence, verification, and freshness, but it lacks a binding rule for stale, conflicting,
unsupported, or model-authored claims. This is a D2 trust and index-integrity deviation.

## Decision

Every execution fact has a stable id, source class/locator, evidence summary, confidence, `verifiedAt`,
`expiresAt`, and status: `draft`, `reviewed`, `deprecated`, or `rejected`. Only a current `reviewed`
fact is eligible for public display, AI retrieval, or SEO.

| Source | Eligibility after review |
| --- | --- |
| Official first-party/government source | eligible while current |
| Direct operator verification with retained evidence | eligible with expiry |
| Reputable editorial source | eligible with conservative wording and expiry |
| User report, model output, or uncorroborated scrape | ineligible until independently reviewed |

Expired, deprecated, rejected, source-less, or unresolved-conflict facts are withheld. Consumers omit
them or say evidence is unavailable; they never infer a substitute. Conflicting facts remain withheld
until an editor resolves or deprecates one.

Copilot can cite only eligible retrieved fact ids and permitted source labels. A model can summarize
retrieved evidence conservatively but cannot invent citations, sources, confidence, or execution facts.
Without retrieval evidence it must answer unknown/insufficient evidence honestly.

Knowledge gaps retain only normalized question patterns, city/category, frequency, and resolution.
They MUST NOT retain raw prompts, contact/payment data, or full Human Task transcripts. Promotion from
task evidence creates a sanitized gap draft, never an automatically public fact.

An SEO page requires unique intent, canonical URL, editorial title/summary, and enough eligible facts
for its promise. Thin, duplicate, unreviewed, or under-evidenced pages are `noindex`. Private Trips are
always `noindex`. Retired pages leave the sitemap and redirect only to a substantively equivalent page.
Launch success is quality-gated coverage, correction/staleness rate, and observed useful search traffic,
not a raw page count.

## Consequences

P0-08 implements retrieval/citation eligibility. P0-16 may create only sanitized gap drafts. P1-01,
Ops facts, Explore, and SEO consumers apply this lifecycle. Required tests cover expiry, conflict,
missing source, citation rejection, no-result honesty, gap minimization, noindex, retirement, and
sitemap exclusion.

## Rollback

Tighten eligibility, deprecate facts, noindex/retire pages, and answer unknown where evidence is
insufficient. Do not preserve questionable content merely to retain traffic.
