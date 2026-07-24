alter table public.llm_call_costs
  drop constraint llm_call_costs_agent_run_id_fkey;

create or replace function internal.enforce_llm_call_cost_agent_run_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' and new.agent_run_id is distinct from old.agent_run_id then
    raise exception using
      errcode = '23514',
      message = 'llm_call_costs.agent_run_id is immutable';
  end if;

  if tg_op = 'INSERT' then
    perform 1
    from public.agent_runs
    where id = new.agent_run_id
    for key share;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'llm_call_costs.agent_run_id must reference an existing agent run';
    end if;
  end if;

  return new;
end;
$$;

revoke all on function internal.enforce_llm_call_cost_agent_run_lifecycle()
  from public, anon, authenticated;

create trigger llm_call_costs_agent_run_lifecycle
before insert or update of agent_run_id on public.llm_call_costs
for each row execute function internal.enforce_llm_call_cost_agent_run_lifecycle();

comment on column public.llm_call_costs.agent_run_id is
  'Immutable opaque correlation id. The referenced Agent Run must exist when the cost row is inserted, but the id intentionally remains after the 30-day trace parent is purged; the cost row follows its own retention deadline.';
