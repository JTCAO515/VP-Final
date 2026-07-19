begin;

create extension if not exists pgtap with schema extensions;

select plan(14);

select has_table('public', 'human_task_evidence', 'Private Human Task evidence exists');
select has_column('public', 'human_task_evidence', 'redaction_classes_jsonb', 'Evidence records redaction classes');
select has_column('public', 'human_task_evidence', 'actor_id', 'Evidence records the trusted actor');
select is(
  (select relrowsecurity from pg_class where oid = 'public.human_task_evidence'::regclass),
  true,
  'Private evidence has RLS enabled'
);
select is(
  has_table_privilege('anon', 'public.human_task_evidence', 'select'),
  false,
  'Anonymous clients cannot read private evidence'
);
select is(
  has_table_privilege('authenticated', 'public.human_task_evidence', 'select'),
  false,
  'Authenticated travelers cannot read private evidence directly'
);
select is(
  (
    select confdeltype::text from pg_constraint
    where conrelid = 'public.human_task_evidence'::regclass
      and conname = 'human_task_evidence_actor_id_fkey'
  ),
  'r',
  'Deleting an actor is restricted while evidence remains'
);

insert into auth.users (
  id, aud, role, email, encrypted_password, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '73000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'evidence-operator@example.com', '', '{}'::jsonb, '{}'::jsonb, now(), now()
);

insert into public.human_tasks (
  id, anon_id, idempotency_key, city, kind, description, contact
) values (
  '73000000-0000-4000-8000-000000000002',
  'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
  '73000000-0000-4000-8000-000000000003', 'Shanghai', 'transport_help',
  'Please explain the accessible route to the station.', 'traveler@example.com'
);

select throws_ok(
  $$insert into public.human_task_evidence (
      task_id, kind, content, actor_id
    ) values (
      '73000000-0000-4000-8000-000000000002', 'outcome',
      'This must not be stored before a terminal outcome.',
      '73000000-0000-4000-8000-000000000001'
    )$$,
  '23514',
  null,
  'Non-terminal task evidence is rejected'
);

update public.human_tasks
set status = 'cancelled', retention_expires_at = now() + interval '90 days'
where id = '73000000-0000-4000-8000-000000000002';

select lives_ok(
  $$insert into public.human_task_evidence (
      id, task_id, kind, content, redaction_classes_jsonb, actor_id
    ) values (
      '73000000-0000-4000-8000-000000000004',
      '73000000-0000-4000-8000-000000000002', 'outcome',
      'The traveler cancelled after the venue was confirmed unavailable.',
      '["email"]'::jsonb,
      '73000000-0000-4000-8000-000000000001'
    )$$,
  'Current terminal task evidence can be stored'
);
select is(
  (select count(*)::integer from public.human_task_evidence),
  1,
  'Exactly one valid evidence row exists'
);

select throws_ok(
  $$update public.human_task_evidence
    set content = 'Mutated evidence must never be accepted.'
    where id = '73000000-0000-4000-8000-000000000004'$$,
  '55000',
  'Human Task evidence is append-only',
  'Privileged updates cannot rewrite append-only evidence'
);
select throws_ok(
  $$delete from public.human_task_evidence
    where id = '73000000-0000-4000-8000-000000000004'$$,
  '55000',
  'Human Task evidence can be deleted only with its task',
  'Evidence cannot be deleted separately while its task remains'
);

update public.human_tasks
set retention_expires_at = now() - interval '1 second'
where id = '73000000-0000-4000-8000-000000000002';
select throws_ok(
  $$insert into public.human_task_evidence (
      task_id, kind, content, actor_id
    ) values (
      '73000000-0000-4000-8000-000000000002', 'outcome',
      'Expired task evidence must never be accepted.',
      '73000000-0000-4000-8000-000000000001'
    )$$,
  '23514',
  null,
  'Expired terminal task evidence is rejected'
);

delete from public.human_tasks where id = '73000000-0000-4000-8000-000000000002';
select is(
  (select count(*)::integer from public.human_task_evidence),
  0,
  'Task deletion cascades to private evidence for retention and account deletion'
);

select * from finish();
rollback;
