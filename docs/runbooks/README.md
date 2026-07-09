# Runbooks

Operational runbooks turn production procedures into repeatable checklists. Keep them short,
current, and tied to the deployed system that exists today.

## Initial Runbook Backlog

| Runbook | Trigger | Owner | Status |
|---|---|---|---|
| Web deploy and rollback | Vercel deployment fails or needs revert | Operator / engineering agent | TODO |
| Supabase migration apply | New migration lands in `infra/supabase/migrations` | Operator | TODO |
| Human Task concierge handling | New request enters `human_tasks` | Operator | TODO |
| Knowledge fact review | Weekly fact sampling and gap cleanup | Operator / ops | TODO |
| AI eval regression | Prompt, model, or router changes | Engineering agent | TODO |

## Runbook Template

```md
# Title

## When to Use

## Preconditions

## Steps

## Verification

## Rollback

## Notes
```
