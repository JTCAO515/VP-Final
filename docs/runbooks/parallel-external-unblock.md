# Parallel External-Unblock Runbook

Status: active
Owner: operator with Codex verification support

## When to Use

Use this runbook to advance the four evidence-bound VisePanda paths in parallel:

1. Creator acquisition attribution and approved-partner activation;
2. lawful payment-route and Stripe test-mode readiness;
3. VisePod investor-prototype evidence; and
4. real operating and lifecycle metrics.

This is an evidence-collection procedure. It does **not** authorize a public redirect, payment,
device service, provider claim, or Phase 2/3 launch before the stated verification passes.

## Shared Rules

- Never put a secret, password, API key, device key, Wi-Fi password, raw user message, passport,
  payment-card data, token, cookie, or database URL in this repository, GitHub, chat, screenshots,
  or the evidence summary.
- Record only the date, environment, verifier, exact non-sensitive outcome, and evidence location.
- A configured setting is not proof of a live capability. The verification step must observe the
  required behavior and its honest unavailable state.
- If a partner, payment, device, or data condition changes, disable the relevant configuration first
  and record the change before attempting a replacement.

## Track A: Creator Partner and Attribution

Associated: OA-019, Issue #99, commercial Explore #58.

### Preconditions

- A real creator or distribution partner has agreed in writing to the proposed relationship.
- The operator has an approved landing-page path and a reviewed disclosure statement.
- The agreement, disclosure, and private contact details stay in the operator's protected records,
  not the repository.

### Steps

1. Create a private one-page partner record outside GitHub.
   - Include the legal/operating party, region, relationship purpose, approved channels, start/end
     date, termination contact, and whether compensation is possible.
   - Do not paste a social-account password, bank information, or private contact into a VisePanda
     ticket.
2. Freeze the public facts.
   - Choose one lowercase referral key using only `a-z`, `0-9`, `_`, and `-`, up to 64 characters.
   - Choose a same-origin path such as `/visepanda`; do not use a full target URL, query string,
     fragment, protocol-relative path, or redirect destination.
   - Approve user-facing disclosure wording before implementation. It must say whether VisePanda may
     receive compensation and must not imply a booking guarantee.
3. Record a sanitized evidence summary in OA-019.
   - Include agreement date, approved referral key, approved path, disclosure-review date, verifier,
     and expiry/review date. Do not include payment amounts or private names.
4. Ask Codex to implement the separate server-side consumer.
   - It must resolve only the private referral mapping, require an active Creator record, apply the
     existing identity/retention rules, and leave the incoming context editable and unsent.
   - A raw creator query parameter, public report, direct outbound target, or automatic activation is
     not allowed.

### Verification and Rollback

- Verify the future consumer accepts only the approved key, shows approved disclosure, creates no
  outbound click, and becomes unavailable if the Creator record is inactive.
- To roll back, deactivate the Creator record and remove the server-side mapping in a forward change;
  do not delete historical audit evidence or edit landed migrations.

## Track B: Payment Decision and Stripe Test Mode

Associated: OA-006, Issue #154.

### Preconditions

- A written legal/business decision names the receiving entity, jurisdiction, offered service type,
  refund owner, support contact, allowed markets, and applicable tax/accounting owner.
- The decision distinguishes real-world Human Help from digital benefits. It must not assume one
  payment rail is lawful for both.

### Steps

1. Put the written decision in the operator's private legal/business record.
2. Give Codex only a sanitized decision summary: entity country/region, service classification,
   refund/support owner, approved test-mode scope, and decision date. Never send an account number,
   secret, tax identifier, or Stripe key through chat.
3. After Codex confirms the decision matches the existing payment boundary, create or select a
   Stripe **test-mode** account owned by that entity.
4. In the Vercel Web project only, add `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the
   approved secret UI for Preview first. Do not add them to source files, `.env.example`, Ops, or a
   GitHub Action.
5. Redeploy Preview and run the controlled test checklist: a quoted task creates one Checkout session,
   duplicate composition reuses it, a valid test webhook transitions exactly once, an invalid/replayed
   webhook is rejected, and an owner sees only the pending-payment entry.
6. Record sanitized results in OA-006. Production remains disabled until the separate production
   decision and evidence are accepted.

### Verification and Rollback

- Test-mode evidence must show status/result codes and opaque IDs only; it must not expose Checkout
  URLs containing sensitive data or webhook payloads.
- Roll back by removing the two Vercel variables from the affected environment and redeploying. The
  product must return its existing honest unavailable state, not a fake payment success.

## Track C: VisePod Evidence Pack

Associated: OA-016, OA-017, Issues #279/#280/#282 and #278.

### Preconditions

- The operator has three to five physically available demonstration devices and a controlled venue.
- Every participant has explicitly consented to the recording/observation purpose and retention
  boundary. Do not use recordings from unaware people.

### Steps

1. Freeze the investor-demo brief.
   - Record the investor audience, demo window/location, acceptable enclosure level, demo city,
     sample Trip/account, and recruitment language/accent mix.
   - Use a non-sensitive sample account and fictional itinerary; no real traveler account is needed.
2. Make a private device inventory.
   - Assign each device a neutral label such as `demo-01`; keep hardware keys, Wi-Fi credentials, and
     serial-number photos in a protected operator location.
   - Record only an approved finite device-id list when OA-016 is ready; never record keys in Vercel.
3. Run a consented 20-run bench test for each required scenario.
   - Record start time, network class, turn outcome, first-audio latency, full-response latency,
     interruption outcome, error code, and whether a fallback was spoken.
   - Test public Wi-Fi/NAT, weak signal, and packet loss separately. Do not claim a result from a
     simulator as hardware evidence.
4. Run a ten-person phone/earbud comparison after the bench gate.
   - Use the same scenario prompts and a consented questionnaire. Store raw recordings privately;
     publish only aggregate counts and de-identified observations.
5. Obtain independent hardware/security review before device authentication, registry, gateway, or
   provisioning work starts.

### Verification and Rollback

- The evidence pack must demonstrate the agreed success rate and first-audio observation; it cannot
  be replaced by a model response, firmware compile, or documentation review.
- If consent, network safety, device integrity, or the demo scope fails, stop the test, remove the
  affected device from the approved inventory, disable relevant environment variables, and retain
  only the minimum incident record permitted by consent.

## Track D: Operating Data and Lifecycle Triggers

Associated: OA-020, Issues #343/#347, #98/#100/#126/#194, and Phase 2/3 Issues.

### Steps

1. Collect 30 to 50 de-identified real travel-task fragments from at least ten travelers for #343.
   - Obtain consent before collection.
   - Remove names, contact details, booking references, documents, account identifiers, and precise
     timestamps before aggregation.
   - Record the task category, journey stage, outcome, confidence, and whether the user requested a
     Show to Local card. Do not synthesize samples to reach the count.
2. Record controlled-preview Human Task operations.
   - For each accepted task, maintain the existing private Ops record; do not copy private task text
     into analytics.
   - At the review window, calculate request count, accepted/cancelled count, response time, operator
     minutes, direct cost, and outcome from durable records.
3. Produce a factual weekly metrics snapshot.
   - Use server-side telemetry/ledger queries for WAU, Copilot success/failure, outbound clicks,
     Human Task count, qualified quotes, repeat-visitor signal, and model cost.
   - Label a metric `unknown` if its source is absent. Do not use mock, sampled marketing, or inferred
     values as trigger evidence.
4. Submit a sanitized evidence summary to the related Issue.
   - #98 needs real outbound/telemetry data.
   - #100 needs measured Phase 1 trigger values.
   - #126 needs real Human Task economics.
   - #194 needs formal launch plus two weeks of observed traffic.
   - Phase 2/3 remains blocked until each Issue's explicit threshold is met.

### Verification and Rollback

- Codex will independently confirm that reported counts come from the approved durable source and that
  the threshold/window matches the Issue before opening any gated implementation.
- If a report contains synthetic, unconsented, or misclassified data, mark it invalid, do not use it
  to unlock a phase, and replace it only with a new consented observation window.

## Completion Record

For each completed track, update the linked OA row with: environment, date, verifier, sanitized
evidence location, observed result, remaining gap, and rollback status. Configuration alone remains
`open`; only the declared verification moves a row to `verified`.
