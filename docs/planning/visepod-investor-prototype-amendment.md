# VisePod Investor Prototype Amendment

Status: draft
Issue: [#279](https://github.com/JTCAO515/VP-Final/issues/279)
Parent initiative: [#278](https://github.com/JTCAO515/VP-Final/issues/278)
Decision class: D3 product-baseline amendment; non-binding until operator and architecture review

## 1. Purpose And Baseline Relationship

VisePod tests one narrow hypothesis: in selected in-China execution moments, a dedicated push-to-talk
device can be faster and less disruptive than unlocking a phone, opening an app, and managing an
earbud interaction.

The prototype is an optional physical endpoint for the existing VisePanda Copilot. It does not create
a second AI, identity, Trip, knowledge, or commercial system. It does not block Phase 0 Web work. A
failed prototype retires the hardware path without removing any Web capability or data asset.

This amendment records a testable proposal. It does not amend the frozen V2 product baseline until
the open operator decisions in section 12 and an independent architecture review are accepted.

## 2. Verified Starting Facts

| Fact | Current truth | Design consequence |
| --- | --- | --- |
| Quantity | Three to five controlled units | Manual provisioning is sufficient; no fleet platform |
| Board | Waveshare ESP32-S3-Touch-AMOLED-1.8 | Firmware belongs in the separate VisePod repository |
| Network | 2.4 GHz Wi-Fi and BLE; no cellular modem | Test public Wi-Fi, NAT, weak signal, loss, and reconnect |
| Interface | Touch AMOLED, microphone, speaker, physical controls | Visible state and sentence-level subtitles are part of the demo |
| AI location | Server-side VisePanda Copilot | No local LLM, STT, TTS, user profile, or Trip copy |
| Audience | Investor demonstration plus later target-user validation | Investor reaction is narrative feedback, not user-value proof |

Any later hardware substitution reopens the network, power, audio, display, and threat assumptions.

## 3. Value Hypothesis And Control

### Hypothesis

VisePod creates value only when the dedicated interaction materially reduces execution friction while
preserving answer quality, privacy, and failure honesty.

### Control condition

The comparison is the same user completing the same scenario with a normal smartphone and earbuds.
The phone path is not intentionally slowed or made less capable. Trial order is counterbalanced to
reduce learning bias.

### What does not count as value evidence

- the device looks novel or animates successfully;
- one end-to-end request works;
- investors say the concept is memorable;
- a model answer is impressive but unrelated to the active Trip;
- the device wins only because the phone control was configured poorly.

## 4. Target User And Use Moment

The validation cohort is an English-speaking foreign traveller who is unfamiliar with China, has
limited Mandarin, and is willing to use a dedicated device during an active trip. Validation should
include variation in accent, age, and smartphone confidence. Medical or emergency dependence is
excluded.

The product moment is short, hands-busy or attention-constrained execution. It is not long-form trip
planning, browsing, document entry, account management, or payment.

## 5. Four Demonstration Scenarios

| Scenario | Demonstration | Required truthful behavior | Pass observation |
| --- | --- | --- | --- |
| Trip context | “What is next, and how do I get there?” | Use the bound demo Trip; say when context is missing; do not mutate the Trip | Correct next block and useful route-oriented answer without invented facts |
| Local communication | Ask for a short phrase to show or say locally | Produce concise Chinese plus sentence-paired speech/subtitle output | User can identify and replay the intended sentence |
| China execution question | Ask a payment, transport, ticket, or venue-execution question | Use eligible knowledge; disclose uncertainty; no commercial link unless the accepted commerce gate permits it | Answer is actionable, bounded, and does not fabricate availability, price, or guarantee |
| PTT interruption | Start a request, cancel during processing or playback, then ask again | Stop the active turn, visibly return to ready, and prevent stale audio from playing | Cancelled turn produces no later playback and the next turn succeeds |

The demo may use a pre-approved, non-sensitive sample account and Trip. It must not silently switch to
mock responses when a provider or network fails.

## 6. Investor Demonstration Story

The recommended story is five to seven minutes:

1. State the traveller friction: a phone is capable but costly to reach for during repeated execution
   moments.
2. Show the same “what is next?” request on the phone control and VisePod.
3. Run one local-communication scenario with sentence-level subtitle/audio pairing.
4. Interrupt one response and recover honestly.
5. Show the monitor's real latency, provider path, failure state, and per-turn STT/LLM/TTS cost.
6. Close with the experiment, not a sales promise: three to five devices test whether the interaction
   deserves a product path.

### Permitted external wording

> VisePod is a controlled VisePanda prototype: a Wi-Fi push-to-talk endpoint that uses the traveller's
> approved Trip context and the existing Copilot. We are testing whether it reduces in-China execution
> friction compared with a phone.

### Prohibited external wording

Do not call it publicly available, production-ready, autonomous, always connected, an emergency
device, a booking device, or a guaranteed translator. Do not claim sales, retention, market demand,
SLA, manufacturing readiness, or a launch date from the prototype.

## 7. Bench Repeatability Gate

Run at least 20 complete, scripted turns across the four scenarios on the intended demonstration
network profile.

| Metric | Prototype target | Collection rule |
| --- | --- | --- |
| Complete-turn success | At least 18 of 20 (90%) | A turn passes only if capture, STT, Copilot, TTS/subtitle, and playback complete |
| End-to-first-audio | Median below 5 seconds | PTT release to first audible response segment; report p90 even if it misses |
| Context correctness | 100% of Trip-context passes reference the bound Trip | Human-scored against the frozen demo Trip |
| Cancellation | No cancelled response plays after cancellation acknowledgement | Exercise during processing and playback |
| Cost trace | One reconciled STT, LLM, and TTS cost trail per completed turn | No estimated provider usage presented as billed fact |
| Safety | Zero provider keys, user profiles, Trips, or raw recordings retained on device | Inspect storage and server retention evidence |
| Revocation | A revoked device cannot obtain a session or reconnect | Negative authentication test |

A missed target is reported with its observed value. The demo UI must not replace failure with mock
success.

## 8. Ten-User Comparative Validation

After bench repeatability passes, recruit at least ten target users who did not build the prototype.
Each participant performs all four scenarios with both VisePod and the phone/earbud control. Alternate
which method comes first.

Collect:

- task completion and wrong-answer count;
- interaction start to first useful audio;
- retries, cancellations, and facilitator interventions;
- a seven-point ease rating after each scenario;
- final method preference and reason;
- whether the user would carry the device for a travel day;
- privacy or social-comfort concerns in the participant's own words.

Advance from user validation only when:

- VisePod completion is not more than five percentage points below the phone control;
- its median start-to-useful-audio time is at least 25% lower in at least two scenarios;
- at least seven of ten participants prefer it in at least two scenarios;
- no severity-one privacy, authentication, stale-playback, or unsafe-advice failure occurs.

Results below these thresholds lead to adjust or stop. They are not averaged away by investor
enthusiasm.

## 9. Continue, Adjust, Or Stop Gates

### Continue to a controlled fleet design

All bench and user gates pass, device revocation and credential handling pass independent review,
and the operator accepts the measured per-turn cost and support burden. “Fleet” still means a bounded
pilot, not public availability.

### Adjust and repeat

Core tasks succeed but latency, Wi-Fi recovery, speech recognition, subtitle pacing, form factor, or
social comfort misses a target that has a small reversible correction. Record the deviation, change
one controlled variable, and repeat the affected comparison.

### Stop the hardware path

Stop when the device does not beat the phone in any scenario after one bounded adjustment, creates a
material privacy/security risk, requires persistent raw audio, cannot recover reliably on realistic
Wi-Fi, or has an unacceptable cost/support burden. Archive the evidence and preserve the Web Copilot.

## 10. Later Productization Triggers

### Fleet management

Do not build fleet management until continue is accepted, all three to five devices pass revocation
and repeated-run testing, and a pilot larger than five devices is explicitly approved.

### Firmware over-the-air updates

Do not build firmware OTA merely for the investor demo. Reconsider it only when devices operate beyond
the operator's physical reach or the approved pilot exceeds five units, and only after signed-image,
rollback, secure-boot, and failed-update recovery decisions are accepted.

### Public sale

An investor demo cannot unlock public sale. Public-sale planning requires a separate D3/D4 decision,
applicable radio/electrical/battery and consumer-compliance review, manufacturing and support owners,
privacy and deletion operations, measured unit economics, and at least four weeks of a controlled
pilot with no unresolved severity-one safety or security defect. No date is promised here.

## 11. G6 Decision Record Template

```text
Decision date:
Decision owner:
Observed devices / runs / users:
Bench success rate and median/p90 first-audio latency:
Phone-control comparison:
Per-turn STT / LLM / TTS cost:
Safety, privacy, and revocation findings:
Expected versus observed deviation (D0-D3):
Decision: continue | adjust | stop
Smallest next control action:
Rollback or retirement action:
Evidence links:
```

## 12. Open Operator Decisions

These items remain deliberately unresolved and must be confirmed in Issue #279 before the amendment
becomes binding:

1. Primary investor audience: financial, travel-industry strategic, hardware strategic, or mixed.
2. Demonstration window and location.
3. Acceptable physical presentation: exposed development board, temporary enclosure, or presentation
   enclosure.
4. Demo city, sample Trip, and permitted non-sensitive demo account.
5. Target-user recruitment channel and language/accent mix for the ten-user comparison.

Until those decisions are recorded, downstream work may use placeholders but cannot claim a fixed
event, market commitment, or finished product form.
