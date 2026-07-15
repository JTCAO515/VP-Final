-- ADR-0006 requires a fact to be explicitly reviewed before any public
-- consumer can use it. Legacy `active` rows predate that lifecycle, so they
-- are conservatively returned to draft rather than promoted without evidence.
alter table public.poi_facts
  drop constraint if exists poi_facts_status_check;

update public.poi_facts
set status = 'draft'
where status = 'active';

alter table public.poi_facts
  alter column status set default 'draft';

alter table public.poi_facts
  add constraint poi_facts_status_check
  check (status in ('draft', 'reviewed', 'deprecated', 'rejected'));

drop policy if exists "poi_facts_public_read_current" on public.poi_facts;
drop policy if exists "poi_facts_public_read_reviewed" on public.poi_facts;

create policy "poi_facts_public_read_reviewed"
on public.poi_facts
for select
to anon, authenticated
using (
  status = 'reviewed'
  and btrim(source) <> ''
  and verified_at <= now()
  and (expires_at is null or expires_at >= now())
);
