create table public.ops_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('operator', 'editor', 'admin')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.ops_audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id text,
  metadata_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index ops_audit_events_actor_created_idx
  on public.ops_audit_events (actor_id, created_at);

alter table public.ops_memberships enable row level security;
alter table public.ops_audit_events enable row level security;

revoke all privileges on table public.ops_memberships from public, anon, authenticated;
revoke all privileges on table public.ops_audit_events from public, anon, authenticated;

comment on table public.ops_memberships is
  'Server-only Ops authorization source. Client metadata and email addresses are never role authority.';
comment on table public.ops_audit_events is
  'Append-only server-side audit evidence for privileged Ops mutations.';
