# Permission and Data Access Constraints

Status: active

- Authentication and authorization MUST be separate checks; a valid session does not imply Ops access.
- Public, anonymous, authenticated-user, operator, and service-role capabilities MUST be explicit.
- Supabase tables containing user, operational, or commercial data MUST enable RLS with least-privilege
  policies before production use.
- Service-role credentials MUST only run in trusted server environments and MUST NOT be sent to Web or
  Mobile clients.
- Ops surfaces MUST require server-verified role authorization and MUST produce audit evidence for
  sensitive mutations.
- Users MUST only read/write their own Trips, memory, entitlements, and Human Tasks unless a documented
  share or operator workflow applies.
- Personal data, prompts, transcripts, and payment evidence MUST be minimized and excluded from routine
  logs and telemetry.
- Deletion/export/retention behavior MUST be documented before collecting a new personal-data class.

Verification: RLS contract tests, route authorization tests, client bundle review, audit events, and
privacy documentation.
