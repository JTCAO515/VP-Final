# API Client Module

Path: `packages/api-client`

## Responsibility

The API client provides a typed tRPC client derived from `AppRouter`. It is the intended shared
network boundary for future Mobile and any runtime that cannot import server code in process.

## Current Interface

`createApiClient(baseUrl)` creates an HTTP batch client targeting `${baseUrl}/trpc`. The exported
`ApiClient` and `AppRouter` types make server operations available without duplicating request and
response types.

Trip inputs intentionally contain no owner identity or replacement snapshot fields. Private reads
return `{ trip, version }`, and existing mutations carry `expectedVersion` plus a Patch so clients
cannot bypass server identity or optimistic concurrency.

## Current Limitation

The repository does not yet expose a stable deployed `/trpc` endpoint. Web and Ops currently create
server callers in process. The client package proves type composition, not network availability.

## Constraints

- API types derive from the server router and domain schemas.
- The client contains no persistence, authentication authority, or business rules.
- Authentication tokens and anonymous session credentials are supplied by the consuming runtime.
- Public API errors use typed, stable codes before Mobile depends on them.
- Breaking router changes require client typecheck and consumer migration evidence.

## Verification

```bash
pnpm --filter @visepanda/api-client typecheck
pnpm --filter @visepanda/api-client test
pnpm --filter @visepanda/api-client build
```
