alter table public.outbound_clicks
  add column user_id uuid references public.users(id) on delete set null,
  add column anon_id text;

alter table public.outbound_clicks
  add constraint outbound_clicks_identity_exclusive_check
  check (num_nonnulls(user_id, anon_id) <= 1);

create index outbound_clicks_user_created_idx
  on public.outbound_clicks(user_id, created_at);

create index outbound_clicks_anon_created_idx
  on public.outbound_clicks(anon_id, created_at);

comment on column public.outbound_clicks.user_id is
  'Verified authenticated identity derived by the server; never accepted from redirect query parameters.';
comment on column public.outbound_clicks.anon_id is
  'Signed anonymous identity derived by the server; never accepted from redirect query parameters.';
