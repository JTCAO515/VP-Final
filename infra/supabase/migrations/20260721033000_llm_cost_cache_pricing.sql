alter table public.llm_call_costs
  add column cached_input_tokens integer not null default 0,
  add column cached_input_price_per_million_usd numeric(14, 8) not null default 0,
  add constraint llm_call_costs_cached_input_tokens_check
    check (cached_input_tokens >= 0 and cached_input_tokens <= input_tokens),
  add constraint llm_call_costs_cached_input_price_per_million_usd_check
    check (cached_input_price_per_million_usd >= 0);

alter table public.events
  add constraint events_cost_pricing_missing_retention_check
    check (
      action <> 'cost_pricing_missing'
      or (retention_expires_at is not null and retention_expires_at > created_at)
    );

comment on column public.llm_call_costs.input_tokens is
  'Provider-reported total prompt tokens, including cached and uncached input.';
comment on column public.llm_call_costs.cached_input_tokens is
  'Provider-reported cached prompt token subset; zero means no cache usage was reported.';
comment on column public.llm_call_costs.input_price_per_million_usd is
  'Immutable cache-miss input price snapshot in USD per million tokens.';
comment on column public.llm_call_costs.cached_input_price_per_million_usd is
  'Immutable cache-hit input price snapshot in USD per million tokens.';
