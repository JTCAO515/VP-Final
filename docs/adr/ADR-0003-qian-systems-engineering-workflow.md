# ADR-0003: Adopt 钱学森 Skills as the permanent engineering workflow

Date: 2026-07-10
Status: Accepted

## Context

The repository has a frozen product baseline, module boundaries, Issues, PR checks, and a new
documentation-as-code mechanism. It still lacks one operational method connecting commercial goals,
system decomposition, interface review, implementation, observation, deviation correction, and
knowledge capture. Without that loop, local delivery can diverge from the overall product.

## Decision

Adopt **钱学森 Skills**, repository id `qian-systems-engineering`, as the permanent workflow for all
product, architecture, code, data, AI, operations, commercial, brand, and marketing changes.

The workflow:

- uses the overall design baseline to translate product strategy into objectives and subsystems;
- freezes cross-module interfaces before parallel implementation;
- treats GitHub Issues as small, reversible control actions;
- requires code, docs, tests, observations, and rollback in one delivery loop;
- classifies deviations D0-D3 and escalates D2/D3 to architecture/operator review;
- combines human judgment, evidence, tools, and AI through traceable meta-synthesis;
- archives learning in docs, ADRs, Issues, evals, facts, or explicit no-action records.

## Alternatives Considered

- Keep independent coding and documentation checklists: rejected because they do not connect
  outcomes to feedback.
- Replace the existing architecture/process wholesale: rejected because the current Fable-5
  baseline is directionally sound and should be controlled, not discarded.
- Let multiple LLMs decide by majority: rejected because correlated model output is not independent
  evidence and has no accountable owner.

## Consequences

- Every normal Issue/PR identifies objective, subsystem, observation, deviation, documentation, and
  lifecycle evidence.
- D2/D3 changes cannot be hidden in implementation work.
- “Merged” and “operationally complete” may differ; an observation owner/date remains when required.
- This ADR is permanent until explicitly superseded; ordinary PRs may improve implementation details
  but may not bypass its control loop.

## Control and Review

Effectiveness is reviewed at release retrospectives using documentation compliance, escaped defects,
rework caused by contract drift, Agent rediscovery time, and unresolved lifecycle follow-ups. A
material failure of the method requires a superseding ADR, not silent abandonment.
