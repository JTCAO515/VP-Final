# Domain Module

Path: `packages/domain`

## Responsibility

The domain package is the only source of runtime-validated business types and deterministic business
functions. It must remain portable across Web, Server, Ops, and future Mobile.

## Public Areas

| Area            | Owns                                                                                                                                                                                                     |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `trip`          | TripState, TripPatch operations, `applyPatch`, `diffTrips`, generation progress                                                                                                                          |
| `copilot`       | Intent, message, citations, tool cards, commercial actions, Human Help handoff, envelope, completion-job contract                                                                                        |
| `knowledge`     | POI, execution facts, knowledge gaps, scene-tag derivation, reviewed seed data, and ADR-0006 fact eligibility                                                                                            |
| `offline`       | Versioned read-only Trip package, local-storage/AsyncStorage serialization, expiry, and credential-free offline boundary                                                                                 |
| `arrival`       | Versioned privacy-minimized Arrival Pack projection: first-day execution summary, verified-address receipts, fixed Readiness result, content versions, and print/offline eligibility                     |
| `readiness`     | Versioned, deterministic China preparation questions, explainable self-reported results, and consented persistence request/result contracts; no score, LLM scoring, or commercial CTA                    |
| `rescue`        | Deterministic incident routing definitions, fail-closed reviewed-target availability, and bounded Human Help offer state                                                                                 |
| `safe-phrases`  | Private operator-verified high-risk fixed-expression contract, exact severity selection, and freshness eligibility                                                                                       |
| `seo`           | Deterministic evidence-gated POI/intent matrix plus private presentation-only editorial override schema for later public page, metadata, and sitemap consumers; it emits gaps instead of thin pages      |
| `task`          | Human Task input, lifecycle, transition commands, private outcome evidence, and non-status updates                                                                                                       |
| `tools`         | Versioned local-only preparation pack for eight execution-tool categories; deterministic action ids, no real-time API, partner URL, or live availability claim                                           |
| `commerce`      | Validated partner configuration, trusted-identity outbound records, active-only HTTPS host validation, and tracking construction                                                                         |
| `events`        | Telemetry event contract                                                                                                                                                                                 |
| `observability` | Redacted Copilot turn, per-attempt cost, product-event action, and forbidden-persistence contracts                                                                                                       |
| `errors`        | Shared typed error shapes                                                                                                                                                                                |
| `visepod`       | Signed Wi-Fi device-turn metadata, raw PCM bounds, indexed playback segments, health/errors, HMAC vector, sentence splitting, portable device lifecycle/control records, and the Studio binding contract |

## Invariants

- Every externally consumed domain object has a Zod schema and inferred TypeScript type.
- Pure functions do not read environment variables, databases, clocks, networks, or UI state unless
  the dependency is passed explicitly.
- Trip mutation is only performed through `applyPatch`.
- Domain enums are never copied into app-local constants.
- Optional fields stay optional; consumers do not fabricate values to make a card look complete.
- Knowledge consumers follow [ADR-0006](../adr/ADR-0006-knowledge-evidence-and-index-quality.md): model output cannot invent facts or citations. Facts retain typed source class/locator, a bounded PII-free evidence summary, ingestion time, nullable independent verification time, and a versioned review policy. Public eligibility additionally requires a private authenticated reviewer and bounded expiry. Retrieval accepts only `isEligiblePoiFact` results, citation ids are request-allowlisted, and no-match answers are explicit.
- Public fact provenance is derived only after `isEligiblePoiFact` succeeds. The accepted public source
  classes are `official`, `operator_verified`, and `reputable_editorial`; user reports, model output,
  uncorroborated scrapes, and raw merchant submissions cannot be upgraded by a presentation consumer.
  Public receipts may expose a source-class label and last-verified date, but never source locators,
  evidence summaries, reviewer identity, authorization state, or internal notes.
- Chinese local-presentation data is not derived from legacy `Poi.nameZh` or `Poi.address` strings.
  `local_name_zh`, `local_address_zh`, `local_address_district`,
  `local_address_nearest_metro_exit`, and `local_address_visibility_note` are independent POI facts.
  `deriveEligiblePoiLocalAddress` returns an address only when exactly one current reviewed
  `local_address_zh` fact exists; missing or ambiguous optional components remain absent.
- Every Show-to-Local, address-card, copy, or speech consumer MUST use
  `resolvePoiLocalAddressPresentation`. Its ready branch contains only the eligible fact derivation;
  its unavailable branch contains the fixed honest message plus Human Help, manual-entry, and
  English-name confirmation alternatives. It cannot read legacy `Poi.address`/`Poi.nameZh` fields and
  never accepts a model-authored fallback. A fact remains displayable until its recorded `expiresAt`
  instant, including during the final 30 days; there is no hidden early user-facing downgrade that
  would contradict the accepted 90-day review policy. Once the current time passes `expiresAt`, it
  becomes unavailable, while knowledge operations may still prioritize near-expiry review separately.
- Place matching is a deterministic, host-testable knowledge function. It indexes English and Chinese
  POI names plus explicit lexical aliases, resolves a unique landmark to its city, and permits only a
  one-character edit-distance match for a single Latin token. Ambiguous and unmatched references are
  explicit results; aliases are lookup metadata, never evidence or a substitute for ADR-0006 eligibility.
- High-risk fixed expressions use the separate `safe-phrases` contract. Only one current reviewed,
  operator-verified expression selected by exact category, scene, intent key, variant key, and
  severity is eligible. A standard and severe variant are never interchangeable; no match or an
  ambiguous match returns unavailable. This schema creates no public display or model-generation path.
- A completion job carries only a Trip reference, base version, idempotency key, bounded attempt state, and safe error code. Its pure state-transition rule permits idempotent reads, `queued -> running`, a running terminal result, and `partial`/`failed -> queued` retry only. It never carries a prompt, model credential, or replacement Trip snapshot.
- Copilot observability records require exactly one trusted identity, a future retention deadline,
  normalized success/failure fields, and pre-persistence redaction. Domain validation rejects direct
  email/phone patterns, registered provider-key shapes, authorization values, natural-language
  cookie/signature assignments, travel documents, and secret-like object keys; runtime redaction
  remains responsible for replacing detected content before parsing.
  `ConversationRedactionClass` is exported from this single contract so server preparation and durable
  persistence cannot drift into separate local label sets.
- Per-attempt cost records preserve provider-reported total input tokens plus a cached-input subset;
  cached tokens cannot exceed total input tokens. Cache-miss and cache-hit input prices are separate
  immutable snapshots. `cost_pricing_missing` is a retained product event, not permission to invent
  a price or silently treat a zero-price row as reconciled.
- Offline Trip packages are a read-only, versioned snapshot of the Trip plus tool and phrase-pack
  versions, cities, and explicit expiry. The snapshot omits arbitrary Trip block metadata and
  rejects authorization/credential-shaped strings before serialization, so it can enter platform
  local storage without becoming a token cache.
- China Readiness is a versioned deterministic assessment. Every one of its ten items records a
  rule id, observed self-report, explicit next action, and evidence status. Unanswered questions
  remain `unknown`; it does not calculate a percentage, infer an answer with an LLM, or expose a
  commercial action. Its portable persistence request rejects anything but explicit `granted`
  consent; server adapters separately enforce ownership, retention, and storage.
- Rescue routing carries category and availability metadata only; it deliberately excludes free-form
  incident narrative. Unreviewed target ids fail closed. Health/safety always routes to the official
  emergency boundary and never offers Human Help, while a Human Help offer requires a matching
  configured city/category and retains the best-effort/no-SLA boundary.
- Rescue telemetry is a separate fixed-metadata extension: browser capture may emit only
  `rescue_started` and `rescue_route_selected` with the enumerated category and deterministic route
  kind. Human Help offer/confirmation and resolution actions remain registered server-only lifecycle
  events until an operational consumer is accepted. No Rescue action accepts narrative, contact,
  location, health detail, or free-form outcome text.
- Tools content is a versioned local preparation pack. It uses local action identifiers rather than
  URLs and contains no partner/booking promise, real-time rate, inventory, or external API call.
  A future consumer must separately prove an action target is available before exposing it.
- Arrival Pack is a separate export projection, not a Trip write path. It includes only first-day
  block title/time/status, current reviewed Chinese-address receipts, fixed Readiness output, and
  version timestamps. It deliberately excludes raw block addresses, descriptions, notes, metadata,
  conversation, credentials, payment data, and passport content. Missing reviewed addresses, phrase
  packs, readiness, or first-day data remain explicit null/empty fields rather than inferred content.
- Arrival Pack telemetry is fixed pack metadata only: generated/downloaded/regenerated actions may
  carry the schema version plus bounded block/address counts and a readiness-presence boolean. It
  must not carry the pack's Trip text, local address, raw HTML, download bytes, or any free-form field.
- SEO candidates are derived only from current ADR-0006-eligible POI facts and carry the exact
  supporting fact ids, unique canonical path, and last verification timestamp. The matrix is not a
  content generator: unsupported POI/intent pairs are represented as gaps and cannot become a public
  candidate, sitemap entry, or fallback page.
- An SEO editorial override is private, Ops-authored presentation data keyed by POI and intent. It
  can replace only bounded title, summary, and emphasis text after a candidate is eligible; it has no
  fact/evidence fields and cannot create, promote, or keep a public candidate alive.
- `events` has two related contracts: a stored telemetry event requires exactly one trusted identity,
  registered action, allowlisted object properties, and a future retention deadline; browser capture
  is a smaller client-safe action union with no persistence metadata or attribution authority. The
  event property validator rejects unrestricted content and sensitive key/text shapes while allowing
  fixed-point numeric amounts used by the bounded cost observation action.
- Human Task status changes use `transitionHumanTask`; the generic update contract cannot carry a
  status. The canonical forward path is `requested -> triaged -> quoted -> payment_pending -> paid ->
fulfilling -> done`, with explicit cancellation edges and no terminal recovery. A transition reason
  is trimmed and bounded to 10-500 characters.
- Human Task evidence is typed as `outcome` or `transcript_excerpt` and is eligible only after
  `done` or `cancelled`. Email/phone data is replaced before persistence; credential, payment, OTP,
  and travel-document content is rejected.
- VisePod v1 validates one HTTPS push-to-talk turn as strict metadata plus raw PCM and validates
  response segments by explicit, contiguous index rather than array order. Device ids and nonces
  accept only RFC 3986 unreserved characters, and the canonical HMAC string, signing vector, audio
  limits, response/error shapes, and deterministic sentence splitter remain portable across firmware,
  server, Web, and Mobile. See [Device Protocol v1](../visepod/device-protocol-v1.md).
- VisePod Studio binding is a separate server-side contract. Its opaque, eight-hour,
  environment-bound grant is limited to `visepod.provision`; exact user lookup returns only a
  masked email hint; a UUID idempotency key is retained for 30 days; and a same-payload replay
  cannot become a second mutation or audit event. Its private server schema preserves revoked
  assignment history, permits one active device assignment, cascades account deletion through
  bindings and idempotency records, and retains only a canonical command digest instead of the raw
  free-text reason. It does not implement a Studio route, token store, or device
  registry. See
  [Studio Binding Contract v1](../visepod/studio-binding-contract-v1.md).
- VisePod device lifecycle is portable domain state only: `inventory`, `provisioned`, `active`,
  `suspended`, `revoked`, and `retired`. It remains independent of `unbound`/`bound` presence;
  only `active + bound` is turn-eligible. The domain records carry no user id, credential, token,
  audio, or authentication semantics. See [Device Domain v1](../visepod/device-domain-v1.md).

## Change Workflow

1. Update or add the Zod schema.
2. Add pure behavior where the rule belongs in the domain.
3. Add tests for valid input, invalid input, and behavior boundaries.
4. Export through the module index and package index.
5. Update this document and any affected contract constraint.
6. Land breaking changes separately before app/server consumers.

## Verification

```bash
pnpm --filter @visepanda/domain typecheck
pnpm --filter @visepanda/domain test
pnpm --filter @visepanda/domain lint
```

Current test suites cover Trip patches, Copilot envelopes, knowledge derivation and local-address
eligibility, deterministic place resolution, safe-phrase freshness and severity selection, task
transitions, commerce URL construction, events, errors, and the VisePod v1 contract/signing vector.
