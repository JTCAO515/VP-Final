-- A batch is private operational metadata used only to group newly committed
-- fact drafts for one-at-a-time review. It deliberately stores no CSV payload,
-- research notes, or operator identity.
create table public.knowledge_import_batches (
  id uuid primary key,
  created_at timestamptz not null default now()
);

alter table public.knowledge_import_batches enable row level security;
revoke all on table public.knowledge_import_batches from anon, authenticated;

-- Historic collection audit rows predate a batch identity and remain null.
-- New imports write the foreign key in the same transaction as their facts.
alter table public.poi_fact_editorial_audit
  add column import_batch_id uuid references public.knowledge_import_batches(id) on delete restrict;

create index poi_fact_editorial_audit_import_batch_idx
  on public.poi_fact_editorial_audit(import_batch_id)
  where import_batch_id is not null;
