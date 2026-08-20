# ADR-0024: Planning and Execution Workspace

Date: 2026-08-20
Status: Accepted
Owner: product / architecture
Issue: [#537](https://github.com/JTCAO515/VP-Final/issues/537)

## Context

ADR-0023 correctly constrained delivery around source-backed China-travel execution, but its wording
demoted planning and Trip Canvas to background context. That no longer matches the operator-approved
product definition or the user-visible workflow: a traveller talks with VisePanda, forms or adjusts a
Trip, reviews it day by day in Canvas, prepares the relevant execution details, then adapts when the
trip changes.

The correction must not re-open the accepted execution-safety, fact-first, TripPatch, provider,
payment, Human Help, or external-evidence gates. It changes product framing and surface ownership, not
an external capability claim.

## Decision

### 1. Product definition

> **VisePanda is the AI planning and execution workspace for independent travel in China.**

VisePanda is not limited to answering a travel question and is not a generic itinerary-text generator.
It combines a conversational planning/execution assistant with a visible, durable Trip Canvas.

### 2. Two cooperating cores

- **VisePanda Chatbot** is the single conversational AI surface. It understands trip goals, dates,
  interests, constraints, questions, and changes; it produces only typed, validated envelopes and
  optional TripPatch outcomes.
- **Trip Canvas** is the single visible Trip-state surface. It shows daily itinerary blocks, places,
  routes, preparation state, and already-authorized execution actions. It never becomes a model-direct
  write path or a source of invented availability.

The core traveller loop is: conversation -> plan -> Canvas review/adjustment -> preparation ->
execution -> adjustment/recovery.

### 3. Delivery discipline remains fact-first

ADR-0023's six execution moments remain the first evidence-gated delivery boundary. Payment, Show to
Local, and Entry / Booking remain the first vertical fact-driven loops. Planning and Canvas framing do
not authorize real-time tickets, automatic booking, payment handling, live Human Help, full-China
coverage, or any external promise without independent evidence.

### 4. Public-language rule

Public copy may say `designed to help`, `product preview`, `early access will include`,
`source-backed travel information`, and `coverage is expanding city by city` when factual. It must not
present preview blocks, sample routes, or planned actions as a live reservation, payment, inventory,
or completed service.

## Consequences

- README, context, baseline, and Landing copy use the planning-and-execution workspace definition.
- `Copilot`, `CopilotEnvelope`, `TripPatch`, and current API/database names remain stable internal
  terms.
- The Landing may visibly pair a static Trip Canvas preview with the Chatbot, while interactive
  capability continues to depend on the existing runtime contracts.
- ADR-0023's statements that planning is only context and Canvas is only a support surface are
  superseded by this ADR. Its technical and fact-first delivery constraints remain accepted.

## Rollback and Review

A future D3 decision may revise the positioning after real traveller evidence. It must be appended as
a new ADR and re-evaluate public copy, current delivery order, and the backlog. This ADR changes no
runtime schema, permissions, or external configuration.
