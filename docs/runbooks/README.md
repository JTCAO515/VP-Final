# Runbooks

Operational runbooks turn production procedures into repeatable checklists. Keep them short,
current, and tied to the deployed system that exists today.

## Active Runbooks

| Runbook                                                   | Trigger                                     | Owner                             |
| --------------------------------------------------------- | ------------------------------------------- | --------------------------------- |
| [Web deploy and rollback](web-deploy-rollback.md)         | Vercel release, failure, or revert          | Operator / platform engineer      |
| [Supabase migration](supabase-migrations.md)              | New migration or data-policy repair         | Operator / data-platform engineer |
| [Human Task concierge](human-task-concierge.md)           | Durable real task enters Ops                | Operator                          |
| [Knowledge fact review](knowledge-fact-review.md)         | Weekly review, expiry, or report            | Knowledge operator                |
| [AI eval regression](ai-eval-regression.md)               | Prompt, model, routing, or retrieval change | AI module owner                   |
| [AI provider configuration](ai-provider-configuration.md) | Preview/staging/production provider setup   | Operator / AI module owner        |

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
