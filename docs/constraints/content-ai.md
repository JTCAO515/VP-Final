# Content AI Constraints

Status: active
Authority: [ADR-0022](../adr/ADR-0022-content-ai-control-boundary.md)

| ID | Requirement | Verification |
| --- | --- | --- |
| CAI-001 | Content AI MUST emit typed private Change Set drafts only. A model MUST NOT publish, execute SQL, delete published content, modify permissions, access secrets, push, merge, disable audit, bypass review, or overwrite a conflict. | Tool allowlist/denial tests; service code review |
| CAI-002 | Authorization MUST precede every Content AI data read and tool mutation. The existing verified Ops identity and service-layer role check are the only authority source. | Route/service denial-before-read tests; RLS contracts |
| CAI-003 | Contributors MUST access only their own drafts. Editors/Admins may access other drafts only through an explicit server-checked permission mapping; city, email, UI state, and model output grant nothing. | RLS and service authorization tests |
| CAI-004 | A model MAY select only an ID returned by bounded deterministic POI retrieval. A missing, out-of-set, or ambiguous ID MUST fail or request clarification; it MUST NOT create a merge or hidden fallback. | Domain/service tests |
| CAI-005 | Structured output attempts per Change Set task MUST be at most two: generation plus one bounded repair. Tool rounds MUST be at most five. Session and import-batch budgets MUST be distinct and fail closed when unconfigured or exhausted. | Orchestrator tests and evals |
| CAI-006 | External or uploaded materials MUST be treated as untrusted data in fixed-delimited model context. They MUST NOT add tools, override policies, or become evidence merely by containing instructions. | Prompt-injection eval fixtures |
| CAI-007 | AI output, a user report, a scrape, and an expired fact MUST NOT become public/retrieval eligible without the existing explicit human fact-review transition and qualifying evidence. | Eligibility and publication tests |
| CAI-008 | A Change Set publish MUST be all-or-nothing. Any stale operation MUST prevent all mutation, retain the draft, and return a human rebase projection. | Transaction/optimistic conflict tests |
| CAI-009 | Content AI audit records MUST be append-only. Approval, rejection, cancellation, correction, rebase, publication, and revocation MUST write minimized audit data atomically; audit failure MUST fail the mutation. | pgTAP/database/service fault-injection tests |
| CAI-010 | Content AI sessions, messages, sources, media drafts, and provider traces MUST have explicit private access and retention behavior before collection. They MUST NOT contain provider keys, database URLs, credentials, cookie values, signatures, or raw provider payloads. | Schema assertions, redaction tests, retention migration review |
| CAI-011 | Copyright-unknown media MUST remain private and unpublished. Existing ADR-0021 file header, size, dimension, EXIF, attribution, license, server-only Storage, and deletion requirements remain mandatory. | Image pipeline tests and Storage contracts |
| CAI-012 | Provider candidates from Amap or Baidu MUST remain private and hidden until a provider-specific official-terms decision allows the exact field/use. Ratings, reviews, prices, coordinates, and images MUST NOT be silently combined or inferred. | Provider contract tests; terms gate review |
| CAI-013 | A GitHub Issue Draft is editable text only. It MUST NOT call GitHub, create an Issue/PR, push a branch, or merge code without a future separately accepted connector decision. | No-client/no-credential tests; UI copy review |
| CAI-014 | CONTENT-AI-01b is a test-only, one-operation walking skeleton for `local_address_nearest_metro_exit`. It MUST remain unavailable for creation or publication outside the test runtime, use owner-scoped private draft reads, require a different authorized reviewer, publish the fact and audit in one transaction, and mark stale fact versions as rebase-required without publishing. It MUST NOT be treated as the generic Change Set contract. | Domain/route tests; database conflict and audit-rollback tests; RLS pgTAP contract |
