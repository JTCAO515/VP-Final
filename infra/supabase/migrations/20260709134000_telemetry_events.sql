create table events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  anon_id text not null,
  surface text not null check (surface in ('web', 'mobile', 'server', 'ops')),
  action text not null,
  entity_type text not null,
  entity_id text,
  intent text,
  partner text,
  click_id uuid,
  props_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index events_anon_created_idx on events(anon_id, created_at);
create index events_action_created_idx on events(action, created_at);

create materialized view trust_funnel_daily as
select
  date_trunc('day', created_at)::date as day,
  count(distinct anon_id) filter (where action = 'anonymous_seen') as anonymous_seen,
  count(distinct coalesce(user_id::text, anon_id)) filter (where action = 'registered') as registered,
  count(*) filter (where action = 'outbound_click') as commercial_clicks,
  count(distinct coalesce(user_id::text, anon_id)) filter (where action = 'first_payment') as first_payments,
  count(distinct coalesce(user_id::text, anon_id)) filter (where action = 'return_visit') as return_visits,
  count(*) filter (where action = 'quote_requested') as quote_requests
from events
group by 1;

create unique index trust_funnel_daily_day_idx on trust_funnel_daily(day);
