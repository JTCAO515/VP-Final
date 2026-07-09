create table public.pois (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  category text not null check (category in ('food', 'attraction', 'hotel', 'shopping', 'experience')),
  name_en text not null,
  name_zh text,
  address text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  source_ids jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.poi_facts (
  id uuid primary key default gen_random_uuid(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  fact_type text not null,
  value_jsonb jsonb not null,
  confidence numeric(4, 3) not null check (confidence >= 0 and confidence <= 1),
  source text not null,
  verified_at timestamptz not null,
  expires_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now()
);

create table public.knowledge_gaps (
  id uuid primary key default gen_random_uuid(),
  question_pattern text not null,
  frequency integer not null default 1 check (frequency > 0),
  city text,
  status text not null default 'open' check (status in ('open', 'resolved', 'ignored')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.poi_commercial_links (
  id uuid primary key default gen_random_uuid(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  partner text not null,
  url text not null,
  disclosure text not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create index pois_city_category_idx on public.pois(city, category);
create index poi_facts_poi_type_idx on public.poi_facts(poi_id, fact_type);
create index knowledge_gaps_status_frequency_idx on public.knowledge_gaps(status, frequency desc);
create index poi_commercial_links_poi_status_idx on public.poi_commercial_links(poi_id, status);

create trigger pois_set_updated_at
before update on public.pois
for each row execute function public.set_updated_at();

create trigger knowledge_gaps_set_updated_at
before update on public.knowledge_gaps
for each row execute function public.set_updated_at();

alter table public.pois enable row level security;
alter table public.poi_facts enable row level security;
alter table public.knowledge_gaps enable row level security;
alter table public.poi_commercial_links enable row level security;

grant select on public.pois to anon, authenticated;
grant select on public.poi_facts to anon, authenticated;
grant select on public.poi_commercial_links to anon, authenticated;

create policy "pois_public_read"
on public.pois
for select
to anon, authenticated
using (true);

create policy "poi_facts_public_read_current"
on public.poi_facts
for select
to anon, authenticated
using (expires_at is null or expires_at >= now());

create policy "poi_commercial_links_public_read_active"
on public.poi_commercial_links
for select
to anon, authenticated
using (status = 'active');
