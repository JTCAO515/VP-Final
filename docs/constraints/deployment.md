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
- The completion callback and QStash delivery use a five-minute request budget. The ten-minute job
  claim lease MUST remain longer than that budget so a still-running callback cannot be reclaimed by
  an overlapping delivery.
- Feature flags MUST have owner, default, exposure rule, expiry/review date, and rollback behavior.
- Rollback MUST NOT reverse an already-applied destructive data change; migrations require a forward
  recovery plan.

Verification: CI, environment review, deployment runbook, smoke test, migration contract, and release
record.
