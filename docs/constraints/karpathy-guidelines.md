# Karpathy Coding Discipline

Status: active
Applies to: implementation, debugging, code review, and refactoring
Upstream: [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills)
Verified commit: `2c606141936f1eeef17fa3043a72095b4765b9c2`
License declared by upstream Skill: MIT

This document adapts the installed `karpathy-guidelines` Skill into enforceable VisePanda rules. It
does not replace [钱学森 Skills](qian-systems-engineering.md): Karpathy discipline controls local code
actions, while 钱学森 Skills controls objectives, interfaces, lifecycle, feedback, and correction.

## Normative Rules

| ID | Mandatory rule | Verification | Required evidence |
| --- | --- | --- | --- |
| KGP-001 | An Agent MUST inspect the authoritative context and state material assumptions before coding. | Issue/PR review | assumptions section or implementation note |
| KGP-002 | If multiple interpretations can change a contract, permission, money flow, data ownership, public promise, or irreversible outcome, the Agent MUST pause for operator resolution. Low-risk ambiguity MAY use an explicit reversible assumption. | review | decision or bounded assumption |
| KGP-003 | The implementation MUST be the smallest sufficient behavior that satisfies the accepted Issue and frozen interfaces. | focused diff | scope-to-diff trace |
| KGP-004 | An Agent MUST NOT add unrequested features, speculative flexibility, configurability, abstractions, dependencies, or impossible-state handling. | review | no out-of-scope behavior |
| KGP-005 | A single-use abstraction MUST NOT be introduced unless it removes demonstrated complexity or matches an accepted local pattern. | code review | reuse/complexity evidence |
| KGP-006 | Every changed line MUST trace to Issue scope, acceptance evidence, or cleanup caused by the change. | focused diff | reviewer trace |
| KGP-007 | Existing local style and module ownership MUST be preserved. Adjacent refactors or formatting churn require separate scope. | lint + review | narrow diff |
| KGP-008 | The change MUST remove imports, variables, functions, fixtures, and docs that it makes unused, but MUST NOT delete unrelated pre-existing dead code. | lint + review | orphan cleanup limited to current change |
| KGP-009 | Vague work MUST be translated into observable success criteria before implementation. | Issue triage | executable acceptance |
| KGP-010 | Each implementation step MUST name its verification command or manual observation and continue until it passes or an honest blocker is recorded. | CI/PR evidence | step-to-check record |
| KGP-011 | An unexpectedly large or abstract diff MUST receive a simplicity review before merge and be reduced or explicitly justified. | reviewer gate | reduced diff or complexity rationale |
| KGP-012 | Simplicity MUST NOT override security, privacy, data integrity, payment integrity, production truthfulness, or accepted interface constraints. | security/architecture review | invariant evidence |

## Required Implementation Loop

```text
authoritative context
  -> assumptions and interpretations
  -> smallest sufficient behavior
  -> executable success criteria
  -> focused test/reproduction
  -> surgical implementation
  -> verification
  -> documentation + handoff
  -> deviation classification
```

## Review Questions

1. Which changed lines cannot be traced to the Issue?
2. What assumption would change behavior if it were false?
3. Is there a smaller implementation that preserves the same contract and evidence?
4. Did the change add flexibility before a second real use case exists?
5. Were adjacent cleanup or style changes bundled?
6. What exact command, fixture, screenshot, query, or runtime observation proves success?

Failure of KGP-002, KGP-003, KGP-006, KGP-010, or KGP-012 blocks merge.
