create table public.visepod_device_bindings (
  id uuid primary key default gen_random_uuid(),
  device_id text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  state text not null default 'active',
  bound_at timestamptz not null default now(),
  bound_by uuid not null references auth.users(id) on delete restrict,
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint visepod_device_bindings_device_id_check
    check (device_id ~ '^[A-Za-z0-9._~\\-]{1,64}$'),
  constraint visepod_device_bindings_state_check
    check (state in ('active', 'revoked')),
  constraint visepod_device_bindings_revoked_state_check
    check (
      (state = 'active' and revoked_at is null and revoked_by is null)
      or (state = 'revoked' and revoked_at is not null and revoked_by is not null)
    )
);

create unique index visepod_device_bindings_device_active_unique
  on public.visepod_device_bindings (device_id)
  where state = 'active';

create index visepod_device_bindings_device_bound_at_idx
  on public.visepod_device_bindings (device_id, bound_at);

create index visepod_device_bindings_user_bound_at_idx
  on public.visepod_device_bindings (user_id, bound_at);

create trigger visepod_device_bindings_set_updated_at
before update on public.visepod_device_bindings
for each row execute function public.set_updated_at();

create table public.visepod_binding_idempotency (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  binding_id uuid not null references public.visepod_device_bindings(id) on delete cascade,
  command_digest text not null,
  response_jsonb jsonb not null,
  retention_expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint visepod_binding_idempotency_command_digest_check
    check (command_digest ~ '^[a-f0-9]{64}$'),
  constraint visepod_binding_idempotency_retention_check
    check (retention_expires_at > created_at)
);

create unique index visepod_binding_idempotency_key_unique
  on public.visepod_binding_idempotency (idempotency_key);

create index visepod_binding_idempotency_binding_created_idx
  on public.visepod_binding_idempotency (binding_id, created_at);

alter table public.visepod_device_bindings enable row level security;
alter table public.visepod_binding_idempotency enable row level security;

revoke all on table public.visepod_device_bindings from public, anon, authenticated;
revoke all on table public.visepod_binding_idempotency from public, anon, authenticated;

comment on table public.visepod_device_bindings is
  'Private server-side VisePod device assignment history. One device may have only one active assignment; user deletion cascades the device relationship.';
comment on table public.visepod_binding_idempotency is
  'Private 30-day VisePod Studio command replay record. Stores only a canonical command SHA-256 digest and bounded result projection; never a provisioning token, reason text, device secret, Wi-Fi credential, session, chat, or audio.';
