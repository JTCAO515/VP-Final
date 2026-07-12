begin;
create extension if not exists pgtap with schema extensions;
select plan(10);
select ok((select relrowsecurity from pg_class where oid = 'public.agent_runs'::regclass), 'agent runs has RLS');
select ok((select relrowsecurity from pg_class where oid = 'public.tool_calls'::regclass), 'tool calls has RLS');
select is(has_table_privilege('anon', 'public.agent_runs', 'select'), false, 'anon cannot read traces');
select is(has_table_privilege('authenticated', 'public.agent_runs', 'select'), false, 'users cannot read traces directly');
select is(has_table_privilege('anon', 'public.tool_calls', 'select'), false, 'anon cannot read tool traces');
select is(has_table_privilege('authenticated', 'public.tool_calls', 'select'), false, 'users cannot read tool traces directly');
select throws_ok(
  $$insert into public.agent_runs (user_id, anon_id, status) values (gen_random_uuid(), 'anon', 'succeeded')$$,
  '23514', null, 'a trace cannot carry two identities'
);
select is(
  has_function_privilege('anon', 'internal.purge_expired_agent_traces()', 'execute'),
  false,
  'anon cannot purge traces'
);
select is(
  has_function_privilege('authenticated', 'internal.purge_expired_agent_traces()', 'execute'),
  false,
  'users cannot purge traces'
);
select ok(
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agent_runs' and column_name = 'expires_at'
  ),
  'agent traces have a retention deadline'
);
select * from finish();
rollback;
