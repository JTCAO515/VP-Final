create table partners (
  key text primary key,
  hosts jsonb not null default '[]'::jsonb,
  categories jsonb not null default '[]'::jsonb,
  cities jsonb not null default '[]'::jsonb,
  tracking_param text not null,
  status text not null default 'pending' check (status in ('pending', 'active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index partners_status_idx on partners(status);

insert into partners (key, hosts, categories, cities, tracking_param, status)
values
  ('tripcom', '["trip.com","www.trip.com"]', '["hotel"]', '["Beijing","Shanghai"]', 'vp_click_id', 'pending'),
  ('klook', '["klook.com","www.klook.com"]', '["attraction","experience"]', '["Beijing","Shanghai"]', 'vp_click_id', 'pending'),
  ('getyourguide', '["getyourguide.com","www.getyourguide.com"]', '["attraction","experience"]', '["Beijing","Shanghai"]', 'vp_click_id', 'pending'),
  ('airalo', '["airalo.com","www.airalo.com"]', '["esim"]', '[]', 'vp_click_id', 'pending');

create table outbound_clicks (
  id uuid primary key default gen_random_uuid(),
  partner text not null references partners(key) on delete restrict,
  target_url text not null,
  source text,
  intent text,
  entity_id text,
  created_at timestamptz not null default now()
);

create index outbound_clicks_partner_created_idx on outbound_clicks(partner, created_at);
