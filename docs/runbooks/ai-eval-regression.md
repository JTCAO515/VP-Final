# AI Evaluation Regression Runbook

Status: active
Owner: AI module owner

## Purpose and Trigger

Use for prompt, model, routing, retrieval, normalization, structured-output, or safety changes.

## Preconditions

- Candidate outputs are deterministic fixtures or generated in a separately identified provider run.
- No API key or private prompt content is committed.
- The changed capability and expected trade-off are written in the Issue.

## Procedure

```bash
pnpm evals
```

For a candidate file:

```bash
EVAL_CANDIDATE_PATH=path/to/candidates.json pnpm evals:trip_generation
```

Compare baseline and candidate on schema validity, task outcome, honesty when evidence is absent,
commercial-intent boundaries, safety, latency, retry rate, and estimated cost. Inspect failures; a
higher aggregate score does not override a red-line regression.

## Verification

- Relevant golden cases pass.
- No regression bypasses TripPatch or citations.
- Unknown/insufficient knowledge remains honest.
- Provider failure returns a real degraded/error outcome.
- PR records command, score, changed cases, and cost/latency evidence where available.

## Rollback

Restore the last accepted prompt/model profile or disable the provider/route through its documented
configuration. Preserve failed candidate output as a regression case when it represents a real risk.
