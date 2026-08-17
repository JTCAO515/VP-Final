# ADR-0022: Content AI Change Set Control Boundary

Date: 2026-08-17
Status: Accepted
Owner: knowledge / operations / AI safety
Issue: [#497](https://github.com/JTCAO515/VP-Final/issues/497)

## Context

VisePanda needs a faster way for content workers to transform observations and approved material into
POI and editorial updates. A conversational assistant can reduce clerical work, but it cannot be an
authority to publish China travel facts. Incorrect Chinese addresses, opening hours, payment claims,
eligibility facts, or media rights create direct trust, safety, and legal risk.

Existing controls already provide fact lifecycle eligibility, per-item fact review, private import
batches, private attributed Ops media storage, non-hierarchical Ops roles, and append-only audit
evidence. Content AI is a governed workflow inside Knowledge and Ops, not a new identity system,
database owner, public content surface, or coding agent.

## Decision

### 1. Content AI proposes Change Sets; humans publish them

Content AI may create or update a private, typed **Content Change Set**. A Change Set contains typed
draft operations with target, expected version, before/after projection, field or fact type,
source/evidence receipt, risk level, model confidence, creator, and human decision. It is not a fact,
a publication command, or an authorization grant.

The only target routes are Supabase Content Draft, Supabase Storage Draft, Import Batch, GitHub Issue
Draft, and No mutation. GitHub Issue Draft is exportable text only. It does not authenticate to
GitHub, create Issues or PRs, push a branch, or merge anything.

The model tool surface permanently excludes `execute_sql`, `publish_without_confirmation`,
`delete_published_content`, `change_permissions`, `read_secrets`, `push_to_main`,
`merge_pull_request`, `disable_audit_log`, `bypass_review`, and `overwrite_version_conflict`. The
Server owns every permitted tool and verifies identity, authorization, target, and parameters before
any data access.

### 2. Business lifecycle is separate from runtime processing

The persisted business status is one of `draft`, `needs_input`, `in_review`, `approved`, `published`,
`rejected`, or `cancelled`. Processing activity is separate bounded metadata: `idle`, `analyzing`, or
`failed`, plus a safe error code. A stale operation is an operation-level conflict, not a business
state that permits partial publication.

A Change Set publish is all-or-nothing. If one expected version is stale, the Server applies none of
its operations and returns a conflict projection. A human rebase flow may load current values and ask
per operation whether to retain the draft or adopt current values. It must never resolve, overwrite,
or partially publish automatically.

### 3. Existing source and review rules remain stronger than AI output

ADR-0006 and ADR-0016 remain authoritative. AI-authored text is `model_output` or private draft
material. It cannot make a fact eligible, overwrite an operator-reviewed fact, replace a current
fact, or turn a missing high-risk field into a plausible value. A source-less Chinese address, hours,
price, booking/passport requirement, foreign-card support, metro exit, medical/safety claim, or
commercial claim remains absent.

An expired reviewed fact is historical and ineligible for public display, retrieval, or SEO. It is
not downgraded into a model-overwritable claim; any replacement still requires an explicit human
review transition and fresh evidence.

### 4. POI selection is deterministic before model reasoning

The Server performs bounded deterministic name, alias, city, category, and geographic retrieval
first. A model may rank or explain only candidate IDs returned by that retrieval. The service
validates every selected ID exists in that bounded result. No match requires clarification or a POI
draft; a model may not invent an ID or merge duplicates.

### 5. Qwen is bounded and untrusted input stays untrusted

The first Content AI model path is DashScope only, with provider/model selected by
`CONTENT_AI_PROVIDER` and `CONTENT_AI_MODEL`. A Change Set task permits at most two structured-output
attempts: one generation and one bounded repair. Tool rounds are independently capped at five. A
session token budget, separate import-batch budget, and fail-closed circuit breaker are required
before runtime activation.

URLs, PDFs, spreadsheets, OCR, import text, and user-provided observations are untrusted data. The
Server presents them in fixed delimited sections labelled untrusted. They are never instructions,
authority, or a reason to retry. Prompt-injection fixtures are mandatory evaluation inputs. Missing
evidence, conflicting sources, and unclear rights become `needs_input`, not model repair work.

### 6. Draft visibility and publication authority are explicit

The existing `ops_memberships` roles remain the only authority. Contributors may read and modify only
their own Content AI drafts. Editors and Admins gain access only through a server-checked content
permission mapping accepted in a later schema/RLS Issue. No city, email, UI visibility, or model claim
grants implicit sharing.

Only explicit human review may reach `approved` or `published`. An Admin's own draft still requires a
visible preview-and-confirm action. High-risk second-review requirements may only be added or kept;
they cannot be lowered by Content AI. Creation, correction, approval, rejection, cancellation,
rebase, publication, and revocation require minimized append-only audit evidence. An audit failure
rolls back the corresponding mutation.

### 7. Media and provider data remain private until separately approved

ADR-0021 remains the media authority: private `ops-poi-images` storage, server-mediated signature
checks, EXIF stripping, generated paths, attribution, license note, and no public delivery all remain
binding. Model alt text or crop suggestions are drafts only. Copyright uncertainty keeps media private
and unavailable for publication. No map-provider image is copied by default.

No Amap or Baidu candidate is persisted, displayed, or treated as source evidence until a separate
official-terms/data-rights decision records exactly which fields, retention, attribution, coordinate
use, and image behavior are allowed. Unclear terms mean unavailable.

### 8. New records are minimized and retained deliberately

Content AI sessions, messages, and source materials collect only what is needed to explain a draft.
They require explicit retention, private RLS, server-only access, and deletion/expiry behavior before
collection begins. Provider keys, service-role keys, database URLs, authorization values, cookies,
signatures, and raw provider payloads are forbidden from model input, logs, audit metadata, and
persisted Content AI records. Provider/model/token/latency/cost/failure measurements reuse the
existing safe trace pattern rather than raw content logging.

## Consequences

- #510 first validates one existing test POI, one metro-exit operation, deterministic Change Set,
  Diff, human confirmation, atomic publish, audit, and conflict response.
- #498 expands domain types only after the walking skeleton yields observed interface feedback.
- #499 creates durable draft, RLS, retention, append-only audit, and publication boundaries.
- #500 and #501 implement restricted tools and Qwen orchestration after those boundaries exist.
- #502 through #505 widen the safe workflow to UI, review, media, and Amap candidates. Baidu and
  GitHub Issue Draft refinement are follow-on slices, not prerequisites for the first safe loop.

## Rollback and Failure Mode

Disable the Content AI route or remove its server-only configuration. Preserve draft/audit history
within retention, cancel pending Change Sets, and keep published facts governed by their ordinary
review lifecycle. A failure tightens to unavailable, unknown, or private draft; it must not fall back
to model-authored facts, partial publish, browser-side authority, or public media delivery.

