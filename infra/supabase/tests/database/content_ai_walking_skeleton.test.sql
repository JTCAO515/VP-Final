begin;
select plan(5);

select has_table('public', 'content_ai_walking_skeleton_drafts', 'walking skeleton table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'public.content_ai_walking_skeleton_drafts'::regclass),
  'walking skeleton table enables RLS'
);
select ok(
  not has_table_privilege('anon', 'public.content_ai_walking_skeleton_drafts', 'select'),
  'anon cannot read walking skeleton drafts'
);
select ok(
  exists(
    select 1 from pg_constraint
    where conrelid = 'public.content_ai_walking_skeleton_drafts'::regclass
      and conname = 'content_ai_walking_skeleton_fact_type_check'
  ),
  'one supported fact type is database constrained'
);
select ok(
  exists(
    select 1 from pg_constraint
    where conrelid = 'public.content_ai_walking_skeleton_drafts'::regclass
      and conname = 'content_ai_walking_skeleton_state_check'
  ),
  'draft state is database constrained'
);

select * from finish();
rollback;
