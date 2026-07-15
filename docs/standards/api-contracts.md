# API and Interface Contract Standard

Status: active

## Contract Authority

- Cross-module payloads are defined in `packages/domain` Zod schemas.
- Server routers expose typed inputs, outputs, and errors.
- `packages/api-client` consumes the server contract; clients do not hand-author equivalent payloads.
- Public HTTP routes that cannot share tRPC types still parse with domain schemas and document their
  stable response envelope.

## Required Contract Properties

Every interface baseline documents:

- owner and consumers;
- input/output schema and optionality;
- authentication and authorization;
- error codes and degraded behavior;
- idempotency/retry behavior;
- version/compatibility strategy;
- telemetry and privacy impact.

## Change Rules

- Additive optional fields are preferred.
- Breaking changes require a standalone contract PR, consumer inventory, migration plan, and ADR
  when architecture or business behavior changes.
- Consumers must tolerate absent optional fields and must not invent values.
- Model/provider output is untrusted. Normalize and parse it before constructing a Copilot envelope.
- Webhooks verify signatures and are idempotent before state mutation.
- Retried write requests require an idempotency key or an equivalent deterministic conflict rule.
- A server router with no configured owning service returns tRPC `SERVICE_UNAVAILABLE`. It MUST NOT
  construct a fixture/memory adapter, retry through another adapter, or fabricate a success response.
- Web Trip/Copilot routes map missing deployed runtime/database composition to HTTP 503 with
  `code: RUNTIME_UNAVAILABLE`; they do not expose the missing setting name, connection value, or
  provider detail in the public response.

## Trip Contract

AI returns a typed Copilot envelope and optional TripPatch. Deterministic domain code validates and
applies the patch. No API, UI, provider, or worker may directly rewrite a Trip snapshot to imitate a
patch.

Private Trip routes derive owner identity from server request context, never from input fields. Existing
Trip mutations require `expectedVersion`, use a conditional owner/version update, and return typed
`409 TRIP_VERSION_CONFLICT` on stale state. Claim uses the verified user plus the current signed
anonymous session; share is an opaque read-only capability. See
[ADR-0004](../adr/ADR-0004-identity-trip-ownership-security.md).

The frozen private service returns a monotonic version with each snapshot. An existing mutation sends
`id`, trusted server identity, `TripPatch`, `expectedVersion`, and event source; it never sends a
replacement snapshot as authority. A confirmed owner with a stale version receives
`TRIP_VERSION_CONFLICT` and safe `currentVersion`; a non-owner receives the same non-enumerating
not-found result as an absent Trip. Empty Patches are successful no-ops and do not advance version.
New Copilot Trips receive a server-generated id. A client sends `tripId` only when referencing an
existing owner-scoped Trip, preventing caller-selected ids from becoming an existence side channel.

Anonymous-to-authenticated claim consumes only a verified authenticated identity that also carries
the current signed anonymous id. Share capabilities are opaque, owner-created, read-only, and
owner-revocable. P0-04b and P0-04c implement the database and HTTP mappings respectively.

## Ops Authorization Contract

Ops pages and APIs verify the Supabase user server-side, then resolve an explicit database membership.
Unauthenticated requests return 401; verified users without the required permission return 403;
missing production Auth/database configuration returns an honest unavailable response. Every
privileged mutation records actor, action, target, and timestamp in the server-only audit ledger.

## Human Help Intake Contract

`POST /api/human-help` accepts `city`, `kind`, `description`, `contact`, and UUID
`idempotency_key`. Identity is server-derived; body owner fields have no authority. P0-13 accepts only
the Shanghai controlled preview and at most five new requests per China calendar day. A successful
response is `{ ok: true, task: { id, status: "requested", created_at } }`; private request content,
operator fields, quotes, and payment data are not returned. Retrying the same key for the same owner
returns the original receipt. Capacity, scope, conflict, missing runtime, and persistence failures
return non-2xx responses and never fabricate a receipt. Reusing a key with changed request content is
a conflict, even for the same owner.
