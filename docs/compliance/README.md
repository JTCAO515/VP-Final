# Compliance Notes

This directory tracks legal, privacy, platform, and operational compliance work. It is not legal
advice; binding decisions require operator approval and, when needed, qualified counsel.

## Compliance Areas

| Area | Current stance | Next artifact |
|---|---|---|
| Privacy | Store only needed user/account/trip/task data | Privacy policy draft |
| Payments | Human Task external payment pending routing decision; Trip Pass must consider IAP | Payment compliance ADR |
| AI safety | High-risk advice routes to official/professional channels | Safety eval set expansion |
| AI trace retention | 30-day server-only metadata retention; daily purge pending OA-004 production verification | [ADR-0007](../adr/ADR-0007-agent-trace-privacy-retention.md) |
| Copilot dialogue and cost retention | 30-day server-only redacted records; runtime writer and daily purge evidence pending | [ADR-0009](../adr/ADR-0009-copilot-conversation-cost-retention.md) |
| Commercial disclosure | Required for partner links and paid tasks | Disclosure copy inventory |

## Hard Rules

- Do not store secrets in code, docs, or examples.
- Do not fabricate legal, visa, medical, price, commission, or booking facts.
- Do not present manual quote placeholders as completed payment integration.
- User memory and preference data must be visible and removable once the account surface exists.
- Copilot conversation records must be redacted before persistence, expire within the accepted
  30-day window, cascade on account deletion, and never expose content through aggregate cost views.
