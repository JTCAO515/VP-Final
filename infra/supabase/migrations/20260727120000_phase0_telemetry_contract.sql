-- P0-19a: one server-owned event contract for Phase 0 observation.
-- Existing rows were read-only audited before this tightening: every row has exactly
-- one identity, an object payload, an accepted action, and a future retention deadline.
do $$
begin
  if exists (
    select 1
    from public.events
    where num_nonnulls(user_id, anon_id) <> 1
       or retention_expires_at is null
       or retention_expires_at <= created_at
       or jsonb_typeof(props_jsonb) <> 'object'
       or action not in (
         'session_started', 'turn_completed', 'anon_limit_hit', 'rate_limited',
         'register_prompt_shown', 'fallback_triggered', 'model_failure',
         'cost_pricing_missing', 'daily_budget_exceeded', 'prompt_submitted',
         'skeleton_received', 'details_completed', 'patch_applied', 'copilot_failed',
         'human_help_suggested', 'guide_viewed', 'poi_viewed', 'scene_filter_used',
         'outbound_clicked', 'partner_redirected', 'human_help_viewed', 'task_started',
         'task_submitted', 'quote_created', 'payment_link_clicked', 'task_paid', 'task_done'
       )
  ) then
    raise exception 'events contains rows that cannot satisfy the Phase 0 telemetry contract';
  end if;
end;
$$;

alter table public.events
  drop constraint if exists events_at_least_one_identity_check,
  alter column retention_expires_at set not null,
  add constraint events_exactly_one_identity_check
    check (num_nonnulls(user_id, anon_id) = 1),
  add constraint events_retention_check
    check (retention_expires_at > created_at),
  add constraint events_registered_action_check
    check (
      action in (
        'session_started', 'turn_completed', 'anon_limit_hit', 'rate_limited',
        'register_prompt_shown', 'fallback_triggered', 'model_failure',
        'cost_pricing_missing', 'daily_budget_exceeded', 'prompt_submitted',
        'skeleton_received', 'details_completed', 'patch_applied', 'copilot_failed',
        'human_help_suggested', 'guide_viewed', 'poi_viewed', 'scene_filter_used',
        'outbound_clicked', 'partner_redirected', 'human_help_viewed', 'task_started',
        'task_submitted', 'quote_created', 'payment_link_clicked', 'task_paid', 'task_done'
      )
    ),
  add constraint events_props_object_check
    check (jsonb_typeof(props_jsonb) = 'object'),
  add constraint events_outbound_continuity_check
    check (
      action not in ('outbound_clicked', 'partner_redirected')
      or (partner is not null and click_id is not null)
    );

create index if not exists events_user_created_idx
  on public.events(user_id, created_at)
  where user_id is not null;
create index if not exists events_partner_created_idx
  on public.events(partner, created_at)
  where partner is not null;
create index if not exists events_click_created_idx
  on public.events(click_id, created_at)
  where click_id is not null;

-- These are ordinary private views, not materialized views. Phase 0 data volume
-- is intentionally small, so they are live and have no refresh operation to drift.
create or replace view internal.phase0_funnel_daily
with (security_invoker = true)
as
with active_events as (
  select *
  from public.events
  where retention_expires_at > now()
), identity_days as (
  select
    date_trunc('day', created_at)::date as day,
    coalesce(user_id::text, anon_id) as identity_id,
    bool_or(anon_id is not null) as anonymous_identity,
    bool_or(user_id is not null) as authenticated_identity
  from active_events
  group by 1, 2
), first_seen as (
  select identity_id, min(day) as first_seen_day
  from identity_days
  group by 1
), event_days as (
  select
    date_trunc('day', created_at)::date as day,
    count(*) filter (where action = 'prompt_submitted') as copilot_prompt_count,
    count(*) filter (where action = 'turn_completed') as copilot_success_count,
    count(*) filter (where action in ('copilot_failed', 'model_failure')) as copilot_failure_count,
    count(*) filter (where action = 'outbound_clicked') as outbound_click_count,
    count(*) filter (where action = 'task_submitted') as human_task_submitted_count,
    count(*) filter (where action = 'task_paid') as human_task_paid_count
  from active_events
  group by 1
), identity_counts as (
  select
    day,
    count(*) filter (where anonymous_identity) as anonymous_visitor_count,
    count(*) filter (where authenticated_identity) as registered_user_count,
    count(*) filter (where first_seen.first_seen_day < identity_days.day) as repeat_visitor_count
  from identity_days
  join first_seen using (identity_id)
  group by identity_days.day
)
select
  event_days.day,
  coalesce(identity_counts.anonymous_visitor_count, 0)::bigint as anonymous_visitor_count,
  coalesce(identity_counts.registered_user_count, 0)::bigint as registered_user_count,
  coalesce(identity_counts.repeat_visitor_count, 0)::bigint as repeat_visitor_count,
  event_days.copilot_prompt_count::bigint,
  event_days.copilot_success_count::bigint,
  event_days.copilot_failure_count::bigint,
  event_days.outbound_click_count::bigint,
  event_days.human_task_submitted_count::bigint,
  event_days.human_task_paid_count::bigint
from event_days
left join identity_counts using (day);

create or replace view internal.phase0_outbound_daily
with (security_invoker = true)
as
with active_outbound as (
  select
    date_trunc('day', created_at)::date as day,
    nullif(props_jsonb ->> 'city', '') as city,
    nullif(props_jsonb ->> 'category', '') as category,
    partner,
    click_id,
    bool_or(action = 'outbound_clicked') as clicked,
    bool_or(action = 'partner_redirected') as redirected
  from public.events
  where retention_expires_at > now()
    and action in ('outbound_clicked', 'partner_redirected')
  group by 1, 2, 3, 4, 5
)
select
  day,
  city,
  category,
  partner,
  count(*) filter (where clicked)::bigint as outbound_click_count,
  count(*) filter (where redirected)::bigint as partner_redirect_count,
  count(*) filter (where clicked and redirected)::bigint as continuous_click_count
from active_outbound
group by 1, 2, 3, 4;

create or replace view internal.phase0_human_help_daily
with (security_invoker = true)
as
select
  date_trunc('day', created_at)::date as day,
  nullif(props_jsonb ->> 'city', '') as city,
  nullif(props_jsonb ->> 'kind', '') as kind,
  count(*) filter (where action = 'human_help_viewed')::bigint as human_help_view_count,
  count(*) filter (where action = 'task_started')::bigint as task_started_count,
  count(*) filter (where action = 'task_submitted')::bigint as task_submitted_count,
  count(*) filter (where action = 'quote_created')::bigint as quote_created_count,
  count(*) filter (where action = 'payment_link_clicked')::bigint as payment_link_clicked_count,
  count(*) filter (where action = 'task_paid')::bigint as task_paid_count,
  count(*) filter (where action = 'task_done')::bigint as task_done_count
from public.events
where retention_expires_at > now()
  and action in (
    'human_help_viewed', 'task_started', 'task_submitted', 'quote_created',
    'payment_link_clicked', 'task_paid', 'task_done'
  )
group by 1, 2, 3;

revoke all on table internal.phase0_funnel_daily from public, anon, authenticated;
revoke all on table internal.phase0_outbound_daily from public, anon, authenticated;
revoke all on table internal.phase0_human_help_daily from public, anon, authenticated;
