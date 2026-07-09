create table if not exists human_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete set null,
  city text not null,
  kind text not null,
  description text not null,
  contact text not null,
  status text not null default 'requested',
  price_usd numeric(12, 2),
  payment_link text,
  operator_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint human_tasks_status_check check (
    status in (
      'requested',
      'triaged',
      'quoted',
      'payment_pending',
      'paid',
      'fulfilling',
      'done',
      'cancelled'
    )
  ),
  constraint human_tasks_kind_check check (
    kind in (
      'call_restaurant',
      'ticket_help',
      'translation_help',
      'transport_help',
      'other'
    )
  ),
  constraint human_tasks_price_usd_check check (price_usd is null or price_usd >= 0)
);

create index if not exists human_tasks_status_created_idx
  on human_tasks(status, created_at);

create index if not exists human_tasks_city_status_idx
  on human_tasks(city, status);
