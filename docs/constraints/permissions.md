# Permission and Data Access Constraints

Status: active

- Authentication and authorization MUST be separate checks; a valid session does not imply Ops access.
- Private request identity MUST come only from verified Supabase SSR session state or a server-issued,
  signed HttpOnly anonymous cookie; client `userId`, `anonId`, email, localStorage, and query values
  MUST NOT authorize access.
- Public, anonymous, authenticated-user, operator, and service-role capabilities MUST be explicit.
- Supabase tables containing user, operational, or commercial data MUST enable RLS with least-privilege
  policies before production use.
- Service-role credentials MUST only run in trusted server environments and MUST NOT be sent to Web or
  Mobile clients.
- Ops surfaces MUST require server-verified role authorization and MUST produce audit evidence for
  sensitive mutations.
- Ops role authority MUST come only from `ops_memberships`. Roles are non-hierarchical and explicit;
  client claims, Auth user metadata, email allowlists, and hidden navigation MUST NOT grant access.
- The first Ops Admin MUST be created through the registered trusted-console bootstrap action. Runtime
  code MUST NOT contain a bootstrap email, default admin, or self-elevation path.
- Users MUST only read/write their own Trips, memory, entitlements, and Human Tasks unless a documented
  share or operator workflow applies.
- A Trip MUST have exactly one effective owner. Anonymous-to-authenticated claim MUST require both the
  current verified user and the current signed anonymous session, be idempotent, and never transfer an
  already authenticated Trip.
- Public Trip sharing MUST use revocable opaque read-only capability tokens and return only the approved
  share projection. It MUST NOT grant mutation or reveal private profile, task, payment, trace, or
  preference data.
- Existing Trip mutation MUST require owner-scoped optimistic concurrency; stale writes MUST return a
  typed conflict and MUST NOT silently overwrite snapshots or events.
- Personal data, prompts, transcripts, and payment evidence MUST be minimized and excluded from routine
  logs and telemetry.
- Deletion/export/retention behavior MUST be documented before collecting a new personal-data class.

Verification: RLS contract tests, route authorization tests, client bundle review, audit events, and
privacy documentation.
