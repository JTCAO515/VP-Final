# Early Access Web Route Contract

Status: frozen v1
Owner: Server / Early Access / Web runtime
Issue: [#555](https://github.com/JTCAO515/VP-Final/issues/555)
Authority: `@visepanda/app-server/web-early-access-route`

## Purpose

One standard `Request -> Response` handler owns Early Access HTTP behavior for both Web apps. The
current and V3 Next.js route files are thin re-exports. The handler composes the existing Domain
input, trusted-address boundary, HMAC-only network digest, rate limiter, durable signup service, and
confirmation-email sender without creating a second store, API meaning, or external proxy.

## Frozen Interface

| Element | Contract |
| --- | --- |
| Owner | `apps/server/src/webEarlyAccessRoute.ts`, exported only as `@visepanda/app-server/web-early-access-route` |
| Inputs | JSON `EarlyAccessSignupInput`; optional bounded honeypot; request user agent; Vercel trusted-address header or explicit test/local-demo identity; server environment through shared composition |
| Outputs | `200 subscribed|already_subscribed`; `400` invalid input; `429` bounded admission with `Retry-After`; `502` saved but confirmation delivery failed; `503` trusted/runtime/rate/email capability unavailable |
| Errors | public responses use the closed safe codes and fixed generic messages; provider, database, address, salt, credential, and raw error detail never cross the boundary |
| Idempotency | normalized email has one durable row; duplicate returns `already_subscribed` and does not resend; a filled honeypot returns a non-identifying success without a write |
| Authorization / abuse | public write with no caller-selected owner; only the first valid Vercel trusted address is admitted in deployed modes; spoofable forwarding headers are ignored; HMAC digest only reaches persistence/rate state |
| Version | frozen v1; input, status/code, idempotency, trusted-address, digest, rate, delivery, or persistence-order changes require contract review |
| Consumers | `apps/web/src/app/api/early-access/route.ts` and `apps/web-v3/src/app/api/early-access/route.ts`, both thin re-exports |

## Processing Order

```text
parse JSON
-> bounded honeypot
-> Domain input validation
-> trusted client address
-> rate admission
-> confirmation sender availability
-> HMAC digest + bounded user agent
-> durable idempotent signup
-> first-submit confirmation attempt
-> truthful response
```

The delivery sender is checked before the durable write. A provider failure after a first durable
signup returns `502` and the duplicate remains idempotent; it does not claim delivery. No response
contains the submitted email, row id, provider id, address, digest, concern, user agent, or secret.

## Shared Trusted Address

`@visepanda/app-server/web-trusted-client` owns the Vercel-only header resolver used by Copilot,
telemetry, and Early Access. Test and `local-demo` use one fixed local identity. A deployed mode
outside trusted Vercel evidence fails closed. IPv6 is canonicalized; caller-controlled
`x-forwarded-for` is never authority.

## Maturity and External Gates

- Current Web and Web V3 consume the same handler.
- Test/local-demo proves first submit, duplicate, failures, admission, and safe responses without
  external data.
- OA-031 remains the authority for production migration/RLS/retention evidence.
- OA-032 remains the authority for a real verified sender, first delivery, and no duplicate resend.
- #563 created and verified the independent V3 project and a Ready explicit Preview. OA-033 remains
  in progress because the project has no Preview database/Redis/Resend variables; the deployed route
  returns honest 503 and is not proof that V3 persistence or email delivery is live.

## Verification

```bash
pnpm --filter @visepanda/app-server typecheck
pnpm --filter @visepanda/app-web test
pnpm --filter @visepanda/app-web-v3 test
pnpm --filter @visepanda/app-web build
pnpm --filter @visepanda/app-web-v3 build
```

Current Web retains the full nine-case route contract and six-case trusted-address suite. V3 proves
the same shared first-submit/duplicate/email-failure consumer and the browser form flow. CI Database
contracts remain the durable persistence authority.

## Rollback

Revert the shared handler/trusted-address ownership and remove the V3 route adapter. Current
Production remains on `apps/web`; no migration, row, sender, Vercel, DNS, or secret rollback is part
of this code change.
