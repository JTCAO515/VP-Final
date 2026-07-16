alter table public.trip_events
  add column completion_job_id uuid references public.copilot_completion_jobs(id) on delete restrict,
  add column completion_attempt integer;

alter table public.trip_events
  add constraint trip_events_completion_provenance_check check (
    num_nonnulls(completion_job_id, completion_attempt) = 0
    or (
      num_nonnulls(completion_job_id, completion_attempt) = 2
      and completion_attempt > 0
      and source = 'ai_copilot'
    )
  );

create unique index trip_events_completion_job_attempt_unique
  on public.trip_events(completion_job_id, completion_attempt)
  where completion_job_id is not null;
