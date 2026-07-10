# TypeScript Standard

Status: active

## Compiler and Types

- Keep TypeScript strict and do not weaken compiler options for a local error.
- Prefer inferred local types and exported domain types from `@visepanda/domain`.
- Do not use `any`. At external boundaries, accept `unknown` and parse it.
- Do not duplicate domain enums, status strings, event names, or API payload types in consumers.
- Avoid type assertions. If runtime evidence is required, add a parser or type guard.

## Runtime Validation

- Zod schemas in `packages/domain` own cross-module and persistence-bound data.
- Parse data at trust boundaries: HTTP input, model output, environment, storage, queue, webhook, CSV.
- Keep pure domain transformations deterministic and side-effect free.
- Return typed errors or discriminated results where failure is expected; reserve throws for failed
  invariants or infrastructure boundaries.

## Modules

- Import from a module's public entry point. Do not reach into another module's private folder.
- Keep service interfaces narrow; adapters implement persistence/provider details behind them.
- Avoid global mutable state. An in-memory adapter must be injectable, test-only/development-only,
  and documented as non-durable.

## Naming

- Use canonical terms from `CONTEXT.md` in code and API names.
- Use `Copilot`, never new `Butler` identifiers.
- Name booleans as predicates (`isActive`, `hasConsent`, `canRetry`).
- Name timestamps with `At`, durations with a unit, and monetary amounts with currency/precision.

## Secrets and Logging

- Read secrets from environment/provider configuration only.
- Never log tokens, credentials, raw payment payloads, or unredacted personal data.
- Error messages exposed to users must be useful without exposing provider internals or secrets.
