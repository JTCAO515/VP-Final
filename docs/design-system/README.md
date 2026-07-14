# Design System Index

The canonical visual specification is [VisePanda V2 Red Gold Design
System](visepanda-v2-red-gold-design-system.md). It defines the current red, foil-gold, porcelain,
ink, and jade system used by product surfaces.

## Document Status

| Document                                                         | Status               | Use                                       |
| ---------------------------------------------------------------- | -------------------- | ----------------------------------------- |
| [Red Gold Design System](visepanda-v2-red-gold-design-system.md) | Active, canonical    | New and changed UI                        |
| [Design System Fusion](visepanda-v2-design-system-fusion.md)     | Historical rationale | Understand how the direction was selected |
| [Original V2 Design System](visepanda-v2-design-system.md)       | Historical candidate | Trace earlier neutral visual exploration  |

`packages/ui` is the executable token source. Web and Ops inject its `designTokenCss` at their root
and consume only `--vp-*` variables for core visual values. Product surfaces may add local semantic
aliases, but must not copy core brand hex values. The package intentionally exports tokens rather
than page components; Web and Native render their own platform-appropriate primitives.
