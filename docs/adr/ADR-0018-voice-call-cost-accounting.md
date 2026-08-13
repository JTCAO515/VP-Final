# ADR-0018: Multi-Meter Voice Call Cost Accounting

Date: 2026-08-13
Status: Accepted
Owner: AI platform / data platform

## Decision

`llm_call_costs` remains the append-only server-only cost ledger and gains additive,
immutable `call_kind` (`llm`, `stt`, `tts`), `metering_unit` (`token`,
`audio_second`, `character`), fixed-point `quantity`, fixed-point unit-price
snapshot, and nullable opaque `device_correlation_id` UUID. Existing rows default
to `llm` / `token`; their frozen token price fields and `cost_usd` semantics do not
change.

One voice turn may write STT, LLM, and TTS rows at the same attempt index. The
unique key is therefore `(agent_run_id, attempt_index, call_kind)`. Device
correlation is server-issued, nullable, has no foreign key, and must never contain
a serial, device secret, credential, fingerprint, or traveler identity.

Non-token cost is `quantity * unit_price_per_million_usd / 1,000,000`, calculated
with BigInt fixed-point arithmetic and HALF_UP rounding to eight USD decimals.
Missing pricing is an auditable zero; a future runtime must emit
`cost_pricing_missing` rather than estimate. Cost rows keep their independent
400-day retention from ADR-0009/0010.

## Boundary

This authorizes schema and deterministic accounting only. It does not activate an
STT/TTS provider, a device runtime, a budget gate, or a claim about real device
costs.
