create table public.visepod_provisioning_grants (
  id uuid primary key default gen_random_uuid(),
  token_digest text not null,
  ops_user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null default 'visepod.provision',
  environment text not null,
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint visepod_provisioning_grants_token_digest_check
    check (token_digest ~ '^[a-f0-9]{64}$'),
  constraint visepod_provisioning_grants_scope_check
    check (scope = 'visepod.provision'),
  constraint visepod_provisioning_grants_environment_check
    check (environment in ('development', 'production')),
  constraint visepod_provisioning_grants_lifetime_check
    check (expires_at = issued_at + interval '8 hours')
);

create unique index visepod_provisioning_grants_token_digest_unique
  on public.visepod_provisioning_grants (token_digest);

create index visepod_provisioning_grants_active_grant_idx
  on public.visepod_provisioning_grants (token_digest, environment, expires_at);

alter table public.visepod_provisioning_grants enable row level security;
revoke all on table public.visepod_provisioning_grants from public, anon, authenticated;

comment on table public.visepod_provisioning_grants is
  'Private VisePod Studio eight-hour, single-scope provisioning grants. Stores only a SHA-256 token digest; raw token material is never persisted.';
