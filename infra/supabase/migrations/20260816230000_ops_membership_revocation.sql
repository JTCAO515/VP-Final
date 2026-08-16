alter table public.ops_memberships
  add column revoked_at timestamptz,
  add column revoked_by uuid references auth.users(id) on delete set null;

create index ops_memberships_active_role_idx
  on public.ops_memberships (role)
  where revoked_at is null;

comment on column public.ops_memberships.revoked_at is
  'Server-only soft revocation timestamp. A revoked membership is not an Ops authority source.';
comment on column public.ops_memberships.revoked_by is
  'Server-derived Ops actor who revoked the membership; retained for authorization history.';
