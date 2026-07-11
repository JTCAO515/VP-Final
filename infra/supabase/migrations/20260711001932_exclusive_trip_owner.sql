-- Authenticated ownership takes precedence for legacy rows that were allowed
-- to carry both columns by the previous at-least-one-owner constraint.
update public.trips
set anon_id = null
where owner is not null and anon_id is not null;

alter table public.trips
  drop constraint if exists trips_owner_or_anon_check;

alter table public.trips
  add constraint trips_exactly_one_owner_check
  check (num_nonnulls(owner, anon_id) = 1);
