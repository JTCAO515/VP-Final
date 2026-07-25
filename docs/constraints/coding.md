# Coding Constraints

Status: active

Normative companion: [Karpathy Coding Discipline](karpathy-guidelines.md)

- Code MUST pass formatting/lint, typecheck, relevant tests, and build before merge.
- External, stored, model-generated, and environment data MUST be parsed at the boundary.
- Production paths MUST NOT fabricate success, POIs, prices, ratings, commissions, bookings, payments,
  citations, or persistence.
- Secrets and service-role credentials MUST NOT enter source, fixtures, screenshots, logs, PR text,
  or git history.
- Existing user work MUST NOT be reverted or overwritten unless explicitly requested.
- Landed database migrations MUST NOT be rewritten.
- Unrelated refactors and dependency updates MUST NOT be bundled with feature/fix work.
- Comments MUST explain non-obvious constraints or intent, not narrate syntax.
- New dependencies MUST have a documented reason, owner, license check, and rollback path.
- Material assumptions MUST be surfaced before implementation; high-risk ambiguity MUST be resolved
  by the responsible operator rather than silently guessed.
- Implementations MUST be the minimum sufficient change for the accepted Issue. Speculative features,
  flexibility, abstractions, and unrelated cleanup MUST NOT be added.
- Every changed line MUST trace to scope, acceptance evidence, or cleanup made necessary by the change.
- Each implementation step MUST name a reproducible verification; work continues until criteria pass
  or an honest blocker is recorded.

## Accessibility and Responsive UI

- Shared navigation MUST provide a keyboard-visible skip link whose target occurs immediately after
  navigation.
- Every primary navigation, form, and command target MUST have an accessible name and a minimum
  44-pixel target in its narrowest supported layout.
- Keyboard-only use MUST reach every primary action with a visible focus indicator. Visual reordering
  MUST NOT place focus after content shown later on screen.
- Status, error, disabled, preview, and unavailable meaning MUST use text in addition to color.
- Changed public layouts MUST be checked at 375, 768, 1280, and 1440 pixels with no horizontal page
  overflow, clipped text, or overlapping controls.
- On narrow screens, the Copilot prompt MUST precede potentially long conversation and Trip content
  in both visual and DOM order.
- Reduced-motion, reduced-transparency, and increased-contrast preferences MUST preserve all
  information and commands.
- Decorative media and symbols MUST be hidden from assistive technology. Informative media and
  unfamiliar icon-only controls MUST have useful labels.

Verification: CI, secret scanning/review, focused diff review, migration contract tests, and dependency
review. Changed UI additionally requires keyboard walkthrough and browser evidence at the four target
widths; automated accessibility checks do not replace those checks.
