create table public.human_task_transitions (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.human_tasks(id) on delete cascade,
  from_status text not null,
  to_status text not null,
  actor_id uuid not null references auth.users(id) on delete restrict,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint human_task_transitions_from_status_check check (
    from_status in ('requested', 'triaged', 'quoted', 'payment_pending', 'paid', 'fulfilling', 'done', 'cancelled')
  ),
  constraint human_task_transitions_to_status_check check (
    to_status in ('requested', 'triaged', 'quoted', 'payment_pending', 'paid', 'fulfilling', 'done', 'cancelled')
  ),
  constraint human_task_transitions_status_change_check check (from_status <> to_status),
  constraint human_task_transitions_reason_length_check check (
    char_length(btrim(reason)) between 10 and 500
  )
);

create index human_task_transitions_task_created_idx
  on public.human_task_transitions(task_id, created_at);
create index human_task_transitions_actor_created_idx
  on public.human_task_transitions(actor_id, created_at);

alter table public.human_task_transitions enable row level security;
revoke all on table public.human_task_transitions from public, anon, authenticated;

comment on table public.human_task_transitions is
  'Append-only Ops audit evidence for each authorized Human Task lifecycle transition.';
comment on column public.human_task_transitions.actor_id is
  'Authenticated Ops user derived server-side; never accepted as a client assertion.';

create or replace function internal.enforce_human_task_status_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status = new.status then
    return new;
  end if;

  if not (
    (old.status = 'requested' and new.status in ('triaged', 'cancelled')) or
    (old.status = 'triaged' and new.status in ('quoted', 'cancelled')) or
    (old.status = 'quoted' and new.status in ('payment_pending', 'cancelled')) or
    (old.status = 'payment_pending' and new.status in ('paid', 'cancelled')) or
    (old.status = 'paid' and new.status in ('fulfilling', 'cancelled')) or
    (old.status = 'fulfilling' and new.status in ('done', 'cancelled'))
  ) then
    raise exception 'invalid Human Task transition from % to %', old.status, new.status
      using errcode = '23514';
  end if;

  return new;
end;
$$;

revoke all on function internal.enforce_human_task_status_transition()
  from public, anon, authenticated;

create trigger human_tasks_enforce_status_transition
before update of status on public.human_tasks
for each row execute function internal.enforce_human_task_status_transition();
