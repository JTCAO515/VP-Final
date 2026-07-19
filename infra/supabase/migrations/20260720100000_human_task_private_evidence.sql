create table public.human_task_evidence (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.human_tasks(id) on delete cascade,
  kind text not null check (kind in ('outcome', 'transcript_excerpt')),
  content text not null check (char_length(btrim(content)) between 10 and 4000),
  redaction_classes_jsonb jsonb not null default '[]'::jsonb
    check (jsonb_typeof(redaction_classes_jsonb) = 'array'),
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index human_task_evidence_task_created_idx
  on public.human_task_evidence(task_id, created_at);

alter table public.human_task_evidence enable row level security;
revoke all on table public.human_task_evidence from public, anon, authenticated;

comment on table public.human_task_evidence is
  'Private append-only, pre-redacted Human Task outcome evidence. Deleted with the task retention lifecycle.';
comment on column public.human_task_evidence.content is
  'Server-sanitized private content. Raw credentials, payment details, and travel-document numbers are rejected.';

create or replace function internal.enforce_human_task_evidence_eligibility()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  task_status text;
  task_retention timestamptz;
begin
  select status, retention_expires_at
    into task_status, task_retention
  from public.human_tasks
  where id = new.task_id;

  if task_status not in ('done', 'cancelled')
    or task_retention is null
    or task_retention <= now()
  then
    raise exception 'Human Task evidence requires a current terminal task retention window'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function internal.enforce_human_task_evidence_eligibility()
  from public, anon, authenticated;

create trigger human_task_evidence_enforce_eligibility
before insert on public.human_task_evidence
for each row execute function internal.enforce_human_task_evidence_eligibility();
