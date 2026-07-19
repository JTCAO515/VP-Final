begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_table('public', 'human_task_transitions', 'Human Task transition audit exists');
select has_column('public', 'human_task_transitions', 'actor_id', 'Transition stores actor');
select has_column('public', 'human_task_transitions', 'reason', 'Transition stores reason');

select is(
  (
    select confdeltype::text
    from pg_constraint
    where conrelid = 'public.human_task_transitions'::regclass
      and conname = 'human_task_transitions_actor_id_fkey'
  ),
  'r',
  'Deleting an actor is restricted while transition evidence exists'
);

select is(
  (select relrowsecurity from pg_class where oid = 'public.human_task_transitions'::regclass),
  true,
  'Transition evidence has RLS enabled'
);
select is(
  has_table_privilege('anon', 'public.human_task_transitions', 'select'),
  false,
  'Anonymous clients cannot read transition evidence'
);
select is(
  has_table_privilege('authenticated', 'public.human_task_transitions', 'select'),
  false,
  'Authenticated clients cannot read transition evidence directly'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '72000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'operator@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.human_tasks (
  id, anon_id, idempotency_key, city, kind, description, contact
) values (
  '72000000-0000-4000-8000-000000000002',
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  '72000000-0000-4000-8000-000000000003', 'Shanghai', 'translation_help',
  'Please translate this request for hotel reception.', 'traveler@example.com'
);

select lives_ok(
  $$update public.human_tasks set status = 'triaged' where id = '72000000-0000-4000-8000-000000000002'$$,
  'The canonical requested to triaged edge is accepted'
);
select throws_ok(
  $$update public.human_tasks set status = 'done' where id = '72000000-0000-4000-8000-000000000002'$$,
  '23514',
  null,
  'Skipping required lifecycle states is rejected'
);
select lives_ok(
  $$update public.human_tasks set status = 'cancelled' where id = '72000000-0000-4000-8000-000000000002'$$,
  'A triaged task may be cancelled'
);
select throws_ok(
  $$update public.human_tasks set status = 'requested' where id = '72000000-0000-4000-8000-000000000002'$$,
  '23514',
  null,
  'A cancelled task cannot silently recover'
);

select lives_ok(
  $$insert into public.human_task_transitions (
      task_id, from_status, to_status, actor_id, reason
    ) values (
      '72000000-0000-4000-8000-000000000002', 'triaged', 'cancelled',
      '72000000-0000-4000-8000-000000000001',
      'The traveler confirmed that assistance is no longer required.'
    )$$,
  'Valid transition evidence can be stored'
);
select throws_ok(
  $$insert into public.human_task_transitions (
      task_id, from_status, to_status, actor_id, reason
    ) values (
      '72000000-0000-4000-8000-000000000002', 'requested', 'triaged',
      '72000000-0000-4000-8000-000000000001', 'too short'
    )$$,
  '23514',
  null,
  'A transition without an auditable reason is rejected'
);

select is(
  (select count(*)::integer from public.human_task_transitions),
  1,
  'Only valid append-only transition evidence remains'
);

select * from finish();
rollback;
