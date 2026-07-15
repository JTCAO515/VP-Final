create table public.copilot_completion_jobs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  base_version integer not null check (base_version >= 0),
  idempotency_key uuid not null unique,
  state text not null default 'queued'
    check (state in ('queued', 'running', 'completed', 'partial', 'failed', 'conflicted')),
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 2 check (max_attempts between 1 and 3),
  error_code text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint copilot_completion_jobs_trip_base_version_unique unique (trip_id, base_version)
);

create index copilot_completion_jobs_state_created_idx
  on public.copilot_completion_jobs(state, created_at);

create trigger copilot_completion_jobs_set_updated_at
before update on public.copilot_completion_jobs
for each row execute function public.set_updated_at();

-- Completion jobs are server-only operational records. A browser reads a
-- sanitized status through an owner-scoped server endpoint, never the table.
alter table public.copilot_completion_jobs enable row level security;
revoke all privileges on table public.copilot_completion_jobs from public, anon, authenticated;
