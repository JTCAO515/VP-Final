alter table public.poi_facts
  add column if not exists status text not null default 'active';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'poi_facts_status_check'
  ) then
    alter table public.poi_facts
      add constraint poi_facts_status_check
      check (status in ('active', 'deprecated'));
  end if;
end $$;

alter table public.knowledge_gaps
  add column if not exists resolved_at timestamptz,
  add column if not exists resolution_target_jsonb jsonb;
