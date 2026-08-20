# Deployment Constraints

Status: active

- Production deploys MUST originate from reviewed repository commits and reproducible CI builds.
- Environment secrets MUST live in deployment secret stores; documentation lists names only.
- Preview, staging-equivalent, and production configuration MUST have explicit ownership and must not
  silently share mutable test data.
- A database migration MUST be applied and verified before code that requires it is promoted.
- Deployments MUST have health/smoke evidence, observability, and a rollback procedure.
- Missing required configuration MUST produce a failed or degraded health state and an honest user
  error, not a mock result.
- The separately deployed Ops application MUST have verified Supabase SSR and database configuration,
  an OA-010 Admin, and server-side RBAC smoke evidence before exposure. Missing configuration MUST NOT
  statically cache an allow or deny decision; authorization runs per request.
- Runtime mode and adapter selection MUST follow [ADR-0005](../adr/ADR-0005-runtime-modes-and-production-adapter-ownership.md): memory is explicit test/local-demo only; deployed modes fail closed for missing required durable dependencies.
- `VISEPANDA_RUNTIME_MODE` MUST be set explicitly to `preview`, `staging`, or `production` in a
  deployed environment. `NODE_ENV`, `VERCEL_ENV`, missing configuration, and transient failure MUST
  NOT infer `local-demo`.
- Turborepo strict-mode builds MUST declare every server variable that changes build or runtime
  behavior in root `globalEnv`. The declaration is names only, participates in the build cache key,
  and MUST NOT expose a secret through a `NEXT_PUBLIC_*` variable.
- The private Ops image writer may use `SUPABASE_SERVICE_ROLE_KEY` only in the separately deployed
  Ops server runtime. It MUST NOT be present in Web, browser, build-time public configuration, logs,
  or source. Missing configuration keeps image upload/delete unavailable; native image processing
  dependencies must build for the deployed Vercel Linux runtime before release.
- A deployment review MUST treat a Turborepo warning that a required server variable is unavailable to
  the application as a configuration failure. It must be fixed and redeployed before a real-provider
  or production-success claim.
- Durable Trip completion MUST use the reviewed official QStash client and the four server-only names
  registered by OA-011: `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`,
  `QSTASH_NEXT_SIGNING_KEY`, and `COPILOT_COMPLETION_CALLBACK_URL`. The callback URL MUST be the exact
  public route used during signature verification. Partial or missing configuration keeps completion
  unavailable; it MUST NOT select process-local delivery or disable signature checks.
- Anonymous Copilot turn control MUST use the official Upstash Redis client with server-only
  `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`. `VISEPANDA_ANON_TURN_LIMIT` is optional and
  defaults to `3`; invalid values fail closed. Missing Redis configuration keeps anonymous Copilot
  unavailable and MUST NOT select a process-local counter outside tests or explicit `local-demo`.
  Reservations and idempotent completion markers MUST share the same 30-day key TTL; an in-flight
  capacity response MUST remain distinct from a completed-limit registration wall.
- Copilot IP rate limiting MUST use the same approved Upstash Redis service plus a distinct server-only
  `VISEPANDA_IP_HASH_SALT` of at least 32 characters. Optional
  `VISEPANDA_COPILOT_IP_RATE_LIMIT_MINUTE` and `VISEPANDA_COPILOT_IP_RATE_LIMIT_HOUR` default to `10`
  and `60`; invalid values fail closed. Only Vercel's `x-vercel-forwarded-for` is trusted, and raw IP,
  salt, cookie, signature, or spoofable `x-forwarded-for` values MUST NOT be stored or logged. Missing
  Vercel trust evidence/configuration keeps all deployed Copilot requests unavailable; only tests and
  explicit `local-demo` may use the fixed local limiter identity.
  The Vercel system marker `VERCEL` is part of the Turborepo env contract; it is platform evidence,
  not a substitute for the explicit `VISEPANDA_RUNTIME_MODE` runtime selection.
- Early Access signup uses the same server-only Upstash endpoint/token, `VISEPANDA_IP_HASH_SALT`, and
  Vercel-only trusted-address resolver, but it prefixes the address before HMAC hashing so its fixed
  five-per-hour admission window never shares a Redis key with Copilot. Missing Redis, hash salt,
  trusted Vercel address, or durable database configuration MUST return an honest unavailable response;
  production MUST NOT fall back to process-local admission or a fabricated signup receipt.
- Public Copilot numeric safety policy MUST follow accepted ADR-0015. The optional server-only
  `VISEPANDA_COPILOT_MAX_INPUT_CODE_UNITS` and `VISEPANDA_COPILOT_MAX_OUTPUT_TOKENS` settings default
  to `8000` and `1600`; `VISEPANDA_AUTHENTICATED_RATE_LIMIT_MINUTE` and
  `VISEPANDA_AUTHENTICATED_RATE_LIMIT_HOUR` default to `20` and `120`. Each setting may lower but
  MUST NOT exceed its default hard ceiling. Invalid values fail closed. Every model attempt,
  including fallback attempts, MUST use the stricter of the public output ceiling and its own
  provider/request limit.
- A verified authenticated Copilot request MUST also pass its separate Upstash identity window after
  the trusted-network guard. Its Redis key is a domain-separated HMAC derived from the verified user
  identity and `VISEPANDA_IP_HASH_SALT`; raw user ids, addresses, cookies, and salts MUST NOT be sent
  to Redis or logs. Missing Redis or hashing configuration fails the authenticated request closed with
  a typed unavailable result rather than falling back to process-local accounting.
- Public Web recovery uses the built-in error boundary and safe structured route logs before any
  optional monitoring adapter. The boundary may show only a generated correlation id and recovery
  actions; route logs may contain only that id, route, capability, and normalized failure class.
  Sentry is not a required dependency or live-service claim: it may be enabled only after OA-008
  records its account, region, sampling, retention, privacy, and alert ownership. Missing Sentry
  configuration MUST leave the same safe local behavior running and MUST NOT crash a deploy.
- Public telemetry capture MUST use the same approved Upstash Redis service and Vercel-only trusted
  address resolver before the telemetry database write. It MUST require both a HMAC-derived verified
  identity window and a HMAC-derived trusted-network window; raw identity, address, salt, cookie,
  signature, and spoofable `x-forwarded-for` MUST NOT enter Redis keys, arguments, logs, events, or
  public errors. Optional `VISEPANDA_TELEMETRY_IDENTITY_RATE_LIMIT_MINUTE` and
  `VISEPANDA_TELEMETRY_IDENTITY_RATE_LIMIT_HOUR` default to `60` and `300`; optional
  `VISEPANDA_TELEMETRY_IP_RATE_LIMIT_MINUTE` and `VISEPANDA_TELEMETRY_IP_RATE_LIMIT_HOUR` default to
  `180` and `900`. Invalid/missing trusted dependencies fail closed with an honest 503; an exhausted
  window returns HTTP 429 plus `Retry-After`. Rejection counters remain bounded, HMAC-keyed per-network
  Redis observations rather than durable telemetry rows so a flood cannot amplify database writes.
- The completion callback and QStash delivery use a five-minute request budget. The ten-minute job
  claim lease MUST remain longer than that budget so a still-running callback cannot be reclaimed by
  an overlapping delivery.
- Database-backed integration tests whose normal test path skips without `DATABASE_URL` MUST be
  listed explicitly in the CI `Database contracts` job before their PR can claim durable verification.
  A skipped test in the general test job is not database evidence. The outbound Commerce adapter is
  included in this explicit database suite because redirect authorization depends on an authoritative
  partner lookup and ledger commit. The Content AI walking-skeleton service is also included because
  its one-operation publication requires an authoritative version check and an audit write in the same
  transaction.
- Partner administration MUST use the durable database adapter in preview, staging, and production;
  no local-demo or process-memory fallback is allowed. Its explicit database integration suite MUST
  remain in the `Database contracts` job because configuration/audit atomicity and rollback cannot be
  established by unit tests alone.
- Feature flags MUST have owner, default, exposure rule, expiry/review date, and rollback behavior.
- Rollback MUST NOT reverse an already-applied destructive data change; migrations require a forward
  recovery plan.

Verification: CI, environment review, deployment runbook, smoke test, migration contract, and release
record.
