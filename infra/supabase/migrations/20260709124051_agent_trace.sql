create table public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete set null,
  intent text,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  input_jsonb jsonb not null default '{}'::jsonb,
  output_jsonb jsonb not null default '{}'::jsonb,
  error text,
  model_provider text,
  model text,
  effort text check (effort is null or effort in ('low', 'medium', 'high')),
  cost_usd numeric(12, 6) not null default 0 check (cost_usd >= 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.tool_calls (
  id uuid primary key default gen_random_uuid(),
  agent_run_id uuid not null references public.agent_runs(id) on delete cascade,
  tool_name text not null,
  status text not null check (status in ('started', 'succeeded', 'failed')),
  input_jsonb jsonb not null default '{}'::jsonb,
  output_jsonb jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index agent_runs_user_created_idx on public.agent_runs(user_id, created_at desc);
create index agent_runs_trip_created_idx on public.agent_runs(trip_id, created_at desc);
create index tool_calls_agent_run_started_idx on public.tool_calls(agent_run_id, started_at);

alter table public.agent_runs enable row level security;
alter table public.tool_calls enable row level security;

grant select, insert, update on public.agent_runs to authenticated;
grant select, insert, update on public.tool_calls to authenticated;

create policy "agent_runs_read_own"
on public.agent_runs
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "agent_runs_insert_own"
on public.agent_runs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "agent_runs_update_own"
on public.agent_runs
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "tool_calls_read_own_run"
on public.tool_calls
for select
to authenticated
using (
  exists (
    select 1 from public.agent_runs
    where agent_runs.id = tool_calls.agent_run_id
      and agent_runs.user_id = (select auth.uid())
  )
);

create policy "tool_calls_insert_own_run"
on public.tool_calls
for insert
to authenticated
with check (
  exists (
    select 1 from public.agent_runs
    where agent_runs.id = tool_calls.agent_run_id
      and agent_runs.user_id = (select auth.uid())
  )
);

create policy "tool_calls_update_own_run"
on public.tool_calls
for update
to authenticated
using (
  exists (
    select 1 from public.agent_runs
    where agent_runs.id = tool_calls.agent_run_id
      and agent_runs.user_id = (select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.agent_runs
    where agent_runs.id = tool_calls.agent_run_id
      and agent_runs.user_id = (select auth.uid())
  )
);
