create extension if not exists pgcrypto;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references public.users(id) on delete cascade,
  head_version integer not null default 0 check (head_version >= 0),
  snapshot_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_events (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  version integer not null check (version > 0),
  patch_jsonb jsonb not null,
  source text not null check (source in ('user_chat', 'user_manual', 'ai_copilot', 'system')),
  created_at timestamptz not null default now(),
  constraint trip_events_trip_id_version_unique unique (trip_id, version)
);

create index trips_owner_idx on public.trips(owner);

create function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger trips_set_updated_at
before update on public.trips
for each row execute function public.set_updated_at();

alter table public.users enable row level security;
alter table public.trips enable row level security;
alter table public.trip_events enable row level security;

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.users to authenticated;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert on public.trip_events to authenticated;

create policy "users_read_own"
on public.users
for select
to authenticated
using ((select auth.uid()) = id);

create policy "users_insert_own"
on public.users
for insert
to authenticated
with check ((select auth.uid()) = id);

create policy "users_update_own"
on public.users
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "users_delete_own"
on public.users
for delete
to authenticated
using ((select auth.uid()) = id);

create policy "trips_read_own"
on public.trips
for select
to authenticated
using ((select auth.uid()) = owner);

create policy "trips_insert_own"
on public.trips
for insert
to authenticated
with check ((select auth.uid()) = owner);

create policy "trips_update_own"
on public.trips
for update
to authenticated
using ((select auth.uid()) = owner)
with check ((select auth.uid()) = owner);

create policy "trips_delete_own"
on public.trips
for delete
to authenticated
using ((select auth.uid()) = owner);

create policy "trip_events_read_own_trip"
on public.trip_events
for select
to authenticated
using (
  exists (
    select 1 from public.trips
    where trips.id = trip_events.trip_id
      and trips.owner = (select auth.uid())
  )
);

create policy "trip_events_insert_own_trip"
on public.trip_events
for insert
to authenticated
with check (
  exists (
    select 1 from public.trips
    where trips.id = trip_events.trip_id
      and trips.owner = (select auth.uid())
  )
);
