# ADR-0023: Chatbot Execution Core

Date: 2026-08-20
Status: Accepted
Owner: product / architecture
Issue: [#521](https://github.com/JTCAO515/VP-Final/issues/521)

## Context

VisePanda has accumulated a capable but broad product foundation: a typed AI response pipeline, Trip
Canvas, knowledge review controls, Readiness, Arrival Pack, Rescue, Human Help, Explore, Ops, mobile
foundations, and controlled-preproduction VisePod work. The current reviewed knowledge set is still
thin, particularly for national, city, and scene-level execution tasks. Continuing independent surface
expansion would create more destinations without improving a traveller's ability to finish a real task.

The operator has approved a D3 product-baseline adjustment. It narrows the product responsibility and
delivery order without replacing the TypeScript monorepo, modular monolith, TripPatch, CopilotEnvelope,
Supabase, Ops, or Expo direction accepted by the V2 frozen baseline.

## Decision

### 1. VisePanda Chatbot is the product center

VisePanda is the conversational execution companion for independent travel in China. The VisePanda
Chatbot is the only AI interaction and execution-orchestration surface. Its job is to turn a traveller's
message into an honest, structured next action or an explicit unavailable/clarification state.

`Copilot`, `CopilotEnvelope`, and `TripPatch` remain stable internal architecture terms. This decision
does not rename APIs, database entities, or domain contracts merely for product copy.

### 2. The current product boundary is six execution moments

The primary product moments are:

1. Payment: preparation, failure diagnosis, and safe alternatives.
2. Show to Local: destination confirmation, Chinese display, driver, and counter communication.
3. Entry / Booking: reservation, passport, entrance, latest-entry, official-channel, and honest
   availability boundaries.
4. Translate / Communicate: on-site dining, allergy, hotel, directions, return, and clarification.
5. Network: eSIM, roaming, connection failure, and offline material.
6. Rescue / Human Help: deterministic recovery, official channels, and human escalation.

Every new primary feature MUST map to one or more of these moments and declare its user task,
inputs, structured delivery, observable success/failure, fallback, supporting facts, operating owner,
and human-escalation boundary.

### 3. Supporting surfaces have narrowed responsibilities

- Trip / Canvas is durable travel context and visible execution state, not the primary product loop.
- Explore is a context-candidate and knowledge-discovery surface, not a separate feed investment.
- Tools are deterministic executors selected by the Chatbot, not competing product entry points.
- Readiness and Arrival Pack prepare a traveller for Payment and Network execution.
- Rescue and Human Help are recovery paths after an automatic capability is unavailable or fails.
- Ops produces and reviews execution facts. Content AI remains a guarded future production aid rather
  than a reason to create unsupported facts.

### 4. Delivery is fact-first and vertically validated

The next structural dependency is scoped execution facts. Existing `PoiFact` records cannot express
national Payment/Network facts, city rules, or scene communication facts. A future closed scope union
will support POI, city, national, and scene facts while retaining existing provenance, review, expiry,
and eligibility gates.

After the scoped-fact contract and persistence path, the first vertical delivery is Payment, followed
by Show to Local and Entry / Booking. Each one must prove Chatbot retrieval, source-backed structured
delivery, execution feedback, and recovery before a shared execution lifecycle is considered.

### 5. Deferred and frozen work remains unavailable

This focus defers new VisePod features, open merchant onboarding, full OTA inventory/order fulfilment,
take-rate/split payments, UGC/community feeds, long-term subscriptions, self-built maps, payment
wallets, global-destination expansion, and multi-agent work whose purpose is demonstration rather than
traveller execution. It does not activate any external payment, partner, booking, inventory, Human Help
SLA, or provider capability.

Generic Content AI persistence and consumers remain paused until scoped facts have produced real
Payment, Show to Local, and Entry content experience. Its v0 later remains limited to text materials,
source metadata, typed Fact Change Sets, human editing/review, all-or-nothing publication, conflict,
and audit. Images, map candidates, automated collection, and bulk approval remain deferred.

## Consequences

- FOCUS-01 reclassifies the open backlog against this decision and records dependency changes.
- FACT-SCOPE-01 freezes the scope union before any Chatbot action consumer or generic Content AI
  persistence resumes.
- A minimal additive Execution Action card may extend the existing Copilot envelope later; it MUST NOT
  introduce a universal task state machine or arbitrary URL/tool payload.
- Existing public surfaces remain truthful about unavailable capabilities. No documentation-only change
  is evidence that a new execution moment is operational.

## Rollback and Review

Revert this ADR and its mapped documentation amendment if operator-observed traveller evidence rejects
the six-moment boundary. A future change to the product center, moments, phase triggers, anti-goals, or
commercial route requires a new D3 ADR and backlog review. This decision changes no runtime data,
permissions, or external configuration.
