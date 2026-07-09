# VisePanda Evals

This directory contains deterministic regression fixtures for AI behavior. The first suite is `trip_generation`, which protects the Copilot planning/editing contract before live model calls are wired into CI.

Run:

```sh
pnpm evals
```

By default the runner validates the golden set itself. Future model runs can write candidate output JSON and pass it with:

```sh
EVAL_CANDIDATE_PATH=path/to/candidates.json pnpm evals:trip_generation
```

Candidate shape:

```json
{
  "suite": "trip_generation",
  "results": [
    {
      "caseId": "beijing-first-timer-3d",
      "intent": "trip_create",
      "patchOps": ["create_trip"],
      "message": "Beijing 3 day starter plan..."
    }
  ]
}
```
