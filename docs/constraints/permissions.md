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
- Human Task owner identity MUST be server-derived and exactly one of verified user or signed anonymous
  session. Public submission responses MUST be minimized to receipt fields. Contacts and descriptions
  are readable only through an owner-scoped service or an Ops route with `task.contact.read`; direct
  client table access is forbidden. Deleting the authenticated owner MUST cascade-delete their Human
  Tasks rather than leave ownerless records or block account deletion.
- Human Task status mutation MUST require `task.write`; the actor MUST come from the verified Ops
  session, never request JSON. Every accepted change MUST atomically persist from/to status, actor,
  bounded reason, and timestamp. Generic task updates MUST NOT accept status.
- Human Task detail requires `task.contact.read`; internal-note mutation requires `task.write` and
  MUST atomically append a server-derived Ops audit event. Audit metadata MUST NOT copy the note,
  description, contact, cookie, credential, or other task PII.
- Private Human Task evidence requires `task.contact.read` to list and `task.write` to append. It MUST
  remain server-only, database-enforced append-only, terminal-task-bound, retention-current, and
  outside public responses and telemetry. Once the retention deadline passes, the API MUST stop
  returning evidence even before the purge job deletes it. Evidence-derived gap proposals MUST
  reject named-person context, credentials, payment/travel-document identifiers, and normalize
  contact PII; they MUST NOT grant Operators general knowledge write access or create, review, or
  publish a fact.
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
- AI trace data MUST follow ADR-0007: server-only allowlisted metadata/digests, one verified or signed
  identity at most, no raw payload/error storage, and an enforceable retention deadline.

Verification: RLS contract tests, route authorization tests, client bundle review, audit events, and
privacy documentation.
