# Reviewed Content Localization Authority

Status: active
Owner: content governance / Web / knowledge operations
Decision basis: [ADR-0006](../adr/ADR-0006-knowledge-evidence-and-index-quality.md), [ADR-0016](../adr/ADR-0016-execution-fact-safety.md), and Issue #433

## Purpose

The shared Web locale catalog may translate authored interface chrome. It does not make a translation authoritative when content carries legal, safety, commercial, or factual meaning. This document freezes the release gate for reviewed translations. It does not authorize a localized legal page, SEO route, POI fact, partner disclosure, price, or Safe Phrase.

## Content Boundary

| Content | UI catalog translation | Reviewed record before public release |
| --- | --- | --- |
| Navigation, labels, buttons, empty states, authored UI hints | Allowed | Not required |
| Legal, privacy, terms, emergency, and Human Help policy bodies | Prohibited | Required |
| SEO/editorial body, metadata, FAQ, and structured data | Prohibited | Required |
| POI fact values, local addresses/names, and evidence summaries | Prohibited | Required plus source-fact eligibility |
| Partner disclosure, price, availability, and service boundaries | Prohibited | Required plus commercial approval |
| Safe Phrase, allergy, symptom, medical, or urgent-safety wording | Prohibited | Required plus ADR-0016 exact-expression eligibility |
| Traveler input, model output, provider errors, Trip data, source documents | Prohibited | Never browser-translate |

Machine translation MAY be a private draft aid. It MUST NOT be marked reviewed, written into an eligible POI fact, emitted as a verified expression, indexed, or rendered publicly before the record below is complete.

## Minimum Reviewed Localization Record

Every public reviewed translation MUST have one durable record. A later consumer may use a database row, but this governance Issue introduces no schema.

| Field | Requirement |
| --- | --- |
| `content_class` | Closed-set class from the boundary table. |
| `source_authority` | Canonical source document, fact, expression, or partner identifier. |
| `source_version` | Immutable source revision, fact version, or content digest; a mutable URL alone is insufficient. |
| `locale` | One supported locale code; an English source is not a translation record. |
| `localized_revision` | Immutable revision or digest of approved localized text. |
| `status` | `draft`, `reviewed`, `deprecated`, or `revoked`; only `reviewed` is publishable. |
| `reviewer_id` | Authenticated reviewer identity, never a display name or model/provider label. |
| `review_evidence` | Private locator to checklist/correspondence; never credentials or traveler data. |
| `reviewed_at` / `expires_at` | UTC review timestamp and explicit freshness boundary; expiry cannot outlive the source. |
| `rollback_reference` | Commit, revision, or procedure that removes the rendition without changing the source. |

The future record MUST enforce: `reviewed` requires all review fields; expiry is after review; `revoked` is never eligible; every lifecycle change creates an audit event. It MUST NOT store provider keys, raw private correspondence, traveler input, cookies, or session credentials.

## Review Authority

The content owner prepares a draft and source-version diff. A named human reviewer appointed for the class approves or rejects it. A preparer MAY review only under an operator-recorded exception; this never applies to legal-policy or medical/safety content.

| Class | Reviewer capability | Additional gate |
| --- | --- | --- |
| Legal/policy | Operator-appointed legal/policy reviewer | Verify public source version and jurisdictional scope. |
| SEO/editorial | Editorial owner with source access | Preserve citations and canonical/source relationships. |
| POI/partner/commercial | Knowledge or commercial owner with retained evidence | Source is independently active, eligible, and current. |
| Safety expression | Qualified safety owner for the phrase class | Exact scene/severity/intent; no paraphrase or substitute. |

Approval evidence MUST name source version, locale, semantic outcome, reviewer, date, expiry rationale, and traveler-visible limits. Plausible wording is not evidence.

## Freshness, Fallback, and Rollback

1. Source-version change, source deprecation/revocation, source ineligibility, or expired translation immediately makes the locale unavailable.
2. A consumer MUST render localized text only when source and translation are both current and `reviewed`. It MUST NOT use draft/model/old text, transliteration, or a plausible substitute.
3. If a reviewed locale is unavailable, render the existing reviewed source language only when that source is public and safe. Otherwise hide it and show an honest unavailable state.
4. A legal/policy, partner, or pricing source update requires a new version and review. A POI rendition never extends source-fact expiry. A Safe Phrase never bypasses ADR-0016.
5. Revocation is immediate: disable the rendition, purge applicable caches, record the reason, and verify fallback/hidden behavior. Historical audit evidence remains private under its owning retention policy.

## Publication Gate and Follow-ons

Before a non-English consumer is released, it MUST prove source eligibility, complete reviewed record, exact source/localized revisions, tested fallback/revocation, and a documented rollout/rollback. SEO routes, metadata, structured data, sitemap entries, and `hreflang` remain absent until a separately accepted SEO consumer proves canonical/indexability behavior.

No consumer is authorized by this document alone. Follow-on work must separately scope: legal/policy registry and fallback; editorial/SEO registry with noindex proof; POI/partner factual attachment reusing source eligibility; or Safe Phrase localization with exact scene/severity tests. Until then, source English or a truthful unavailable state is the only public behavior.
