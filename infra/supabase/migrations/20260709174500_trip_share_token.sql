alter table public.trips
  add column if not exists share_token text;

create unique index if not exists trips_share_token_unique
  on public.trips (share_token)
  where share_token is not null;
