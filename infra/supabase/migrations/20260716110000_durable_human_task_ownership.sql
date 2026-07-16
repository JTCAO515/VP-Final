-- P0-13 is the first product path allowed to write Human Tasks durably. Any
-- pre-existing row has no accepted owner/idempotency evidence, so stop for
-- explicit remediation rather than deleting, adopting, or fabricating it.
do $$
begin
  if exists (select 1 from public.human_tasks) then
    raise exception using
      message = 'human_tasks contains pre-P0-13 rows that require explicit owner remediation';
  end if;
end
$$;

alter table public.human_tasks
  add column anon_id text,
  add column idempotency_key uuid,
  add column retention_expires_at timestamptz;

alter table public.human_tasks
  alter column idempotency_key set not null,
  drop constraint if exists human_tasks_user_id_fkey,
  add constraint human_tasks_user_id_fkey
    foreign key (user_id) references public.users(id) on delete cascade,
  add constraint human_tasks_exactly_one_owner_check
    check (num_nonnulls(user_id, anon_id) = 1),
  add constraint human_tasks_anon_id_format_check
    check (anon_id is null or anon_id ~ '^[A-Za-z0-9_-]{43}$'),
  add constraint human_tasks_retention_terminal_check
    check (retention_expires_at is null or status in ('done', 'cancelled'));

create unique index human_tasks_idempotency_key_unique
  on public.human_tasks(idempotency_key);

create index human_tasks_user_created_idx
  on public.human_tasks(user_id, created_at);

create index human_tasks_anon_created_idx
  on public.human_tasks(anon_id, created_at);

create trigger human_tasks_set_updated_at
before update on public.human_tasks
for each row execute function public.set_updated_at();

create or replace function internal.purge_expired_human_tasks()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_count bigint;
begin
  delete from public.human_tasks
  where retention_expires_at is not null
    and retention_expires_at <= now();
  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;

revoke all on table public.human_tasks from public, anon, authenticated;
revoke all on function internal.purge_expired_human_tasks() from public, anon, authenticated;
