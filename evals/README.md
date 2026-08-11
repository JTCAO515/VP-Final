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
# Evaluation Suites

`pnpm evals` is a blocking CI gate, not an advisory report.

## Trip generation

`evals:trip_generation` validates the golden-case contract and, when supplied, evaluates a separately
identified candidate file. It does not make live provider calls.

## Deterministic execution safety

`evals:safety_runtime` runs the actual Copilot pipeline against adversarial English and Chinese
inputs. It freezes these invariants from SAFETY-01d:

- all five high-risk categories bypass free generation and can return only an exact reviewed fixed
  expression;
- missing fixed expressions return the category's frozen honest-unavailable response;
- a request to guess a destination address never returns a concrete address; and
- unsupported routes, times, prices, and opening hours reject before presentation, even when the
  traveler explicitly asks the model to guess.

The suite uses deterministic fixtures only. It neither sends user content to a provider nor accepts a
model response as proof of safety.
