# Iteration 0 Real Travel Task Research Protocol

Status: active  
Owner: product research  
Issue: [#342](https://github.com/JTCAO515/VP-Final/issues/342)  
Scope: research language only; not a product, domain, event, or state-machine contract

## Purpose and Boundary

Iteration 0 records comparable evidence about a traveler completing one goal in one China situation.
It guides later discovery only. It does not define a `TravelTask` entity, lifecycle, event, UI, or
delivery commitment. A scorecard is never permission to build a feature.

Machine-readable assets live under [`research/iteration-0/`](../../research/iteration-0/):

| Asset | Purpose | Status |
| --- | --- | --- |
| [`schema/real-travel-task-fragment.schema.json`](../../research/iteration-0/schema/real-travel-task-fragment.schema.json) | Schema for one sanitized real fragment | active collection schema |
| [`schema/candidate-task-scorecard.schema.json`](../../research/iteration-0/schema/candidate-task-scorecard.schema.json) | Schema for a reviewable scorecard | active analysis schema |
| `records/*.json` | One sanitized real fragment per file | empty until collection begins |
| `scorecards/*.json` | Scorecards derived from real fragment IDs | empty until enough real fragments exist |
| `examples/*.json` | Fictional format examples | never analysis input |

Future scripts MUST read only `records/*.json` and `scorecards/*.json`, validate against their schemas,
and reject any record whose `record_class` is not `real`. Examples are isolated so they cannot count as
user evidence.

## Record and Source Discipline

Each fragment records stage/context, goal, current approach, failure, time pressure, consequence,
completion evidence, human-help need, willingness to pay, and an opaque source trace. An unknown value
MUST be `null` and named in `unknown_fields`. A plausible AI, researcher, or agent completion is never
evidence.

`source_trace` contains only an opaque source reference, controlled channel, day-level observation date,
opaque collector alias, and consent status. A separate protected operator index may link the reference
to consent/original material. Raw transcripts, screenshots, names, emails, phones, booking IDs,
payment details, government-document details, and device identifiers MUST NOT enter this repository or
GitHub.

1. **Real users only.** AI conversations, synthetic personas, scraped snippets, and reconstructed
   stories MUST NOT enter `records/` or count toward a scorecard.
2. **Do not guess.** Never infer motive, deadline, outcome, payment willingness, or consequence.
3. **Record the situation, not a feature pitch.** Capture what happened before proposing a tool.
4. **Keep one fragment atomic.** Split unrelated problems into separate traceable records.
5. **No public claim from research.** A fragment or scorecard creates no product promise or metric.

## Candidate Scorecards

Create `scorecards/*.json` only after citing real `task_fragment_ids`.

| Dimension | `1` | `5` |
| --- | --- | --- |
| `frequency` | isolated in observed sample | recurring across independent fragments |
| `time_pressure` | can wait | immediately time-sensitive |
| `web_completeness` | Web cannot finish the goal | Web can finish it unaided |
| `external_dependency` | no outside party is needed | completion depends on an outside party/system |
| `fabrication_risk` | evidence is conservatively stateable | an unsupported claim is especially harmful |
| `differentiation` | generic help fits the problem | China execution coordination is distinctive |

Each non-null score needs evidence rationale. There is no weighted total, rank, or automatic winner;
selection remains human review against retained real evidence. Missing dimensions stay `null` and are
listed in `unknown_dimensions`.

## Review and Examples

Before turning a candidate into an Issue, a reviewer MUST verify cited fragments are real,
schema-valid, traceable, and PII-free; no model/example influenced counts; unknowns remain visible; and
the proposal is a new reviewed hypothesis. Otherwise correct/discard the research record and do not
start feature implementation.

Files in `examples/` are invented format examples. They use `record_class: illustrative` and MUST stay
outside analysis globs, reports, and candidate-selection counts.
