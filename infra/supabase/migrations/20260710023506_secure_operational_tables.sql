-- Operational data is written and read through the server runtime only. It is
-- never a direct Supabase Data API surface for anonymous or signed-in clients.
alter table public.partners enable row level security;
alter table public.outbound_clicks enable row level security;
alter table public.events enable row level security;
alter table public.human_tasks enable row level security;

revoke all privileges on table public.partners from public, anon, authenticated;
revoke all privileges on table public.outbound_clicks from public, anon, authenticated;
revoke all privileges on table public.events from public, anon, authenticated;
revoke all privileges on table public.human_tasks from public, anon, authenticated;

-- Funnel aggregates are operational analytics. Keep them outside `public`,
-- whose views otherwise form part of the Data API surface by default.
create schema if not exists internal;
revoke all privileges on schema internal from public, anon, authenticated;
revoke all privileges on table public.trust_funnel_daily from public, anon, authenticated;
alter materialized view public.trust_funnel_daily set schema internal;
revoke all privileges on table internal.trust_funnel_daily from public, anon, authenticated;

-- Future internal analytics tables remain private unless a migration grants a
-- specific role access deliberately.
alter default privileges for role postgres in schema internal
  revoke all on tables from public, anon, authenticated;
