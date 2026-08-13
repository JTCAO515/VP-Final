create table public.seo_editorial_overrides (
  id uuid primary key default gen_random_uuid(),
  poi_id uuid not null references public.pois(id) on delete cascade,
  intent text not null,
  title text,
  summary text,
  emphasis text,
  created_by uuid not null references public.ops_memberships(user_id) on delete restrict,
  updated_by uuid not null references public.ops_memberships(user_id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint seo_editorial_overrides_poi_intent_unique unique (poi_id, intent),
  constraint seo_editorial_overrides_intent_check
    check (intent in ('payment', 'transport', 'ticket', 'first_timer', 'rainy_day')),
  constraint seo_editorial_overrides_nonempty_check
    check (title is not null or summary is not null or emphasis is not null),
  constraint seo_editorial_overrides_title_check
    check (title is null or (btrim(title) <> '' and char_length(btrim(title)) <= 140)),
  constraint seo_editorial_overrides_summary_check
    check (summary is null or (btrim(summary) <> '' and char_length(btrim(summary)) <= 240)),
  constraint seo_editorial_overrides_emphasis_check
    check (emphasis is null or (btrim(emphasis) <> '' and char_length(btrim(emphasis)) <= 600))
);

alter table public.seo_editorial_overrides enable row level security;
revoke all on table public.seo_editorial_overrides from public, anon, authenticated;

comment on table public.seo_editorial_overrides is
  'Private Ops-authored presentation overrides for evidence-gated SEO candidates. It never changes POI or POI fact evidence.';
