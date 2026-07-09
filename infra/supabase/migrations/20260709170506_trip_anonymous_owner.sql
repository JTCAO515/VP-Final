alter table public.trips
  add column anon_id text,
  alter column owner drop not null;

alter table public.trips
  add constraint trips_owner_or_anon_check
  check (owner is not null or anon_id is not null);

create index trips_anon_id_idx on public.trips(anon_id);

drop policy if exists "trips_insert_own" on public.trips;
drop policy if exists "trips_update_own" on public.trips;

create policy "trips_insert_own"
on public.trips
for insert
to authenticated
with check ((select auth.uid()) = owner and anon_id is null);

create policy "trips_update_own"
on public.trips
for update
to authenticated
using ((select auth.uid()) = owner)
with check ((select auth.uid()) = owner);
