# UI Module

Path: `packages/ui`

## Responsibility

The UI package will own shared design tokens and intentionally small cross-surface primitive
contracts. It must not become a page-level component dump or force Web and Native to share unsuitable
rendering implementations.

## Current State

The package exports the active platform-neutral semantic tokens, a root CSS custom-property payload,
and contrast/drift tests. Web and Ops inject the same token payload at their root layouts and use
local aliases only as references to `--vp-*` variables. The canonical visual specification remains
the [Red Gold Design System](../design-system/visepanda-v2-red-gold-design-system.md).

## Intended Scope

- Color, spacing, typography, radius, elevation, and motion tokens.
- Semantic status colors and accessibility requirements.
- Primitive contracts with separate Web and Native implementations where needed.
- Shared icons and content tokens only when ownership is clear.

## Non-Scope

- Route-specific page composition.
- Server data access.
- Domain state mutation.
- One implementation forced across DOM and React Native when platform behavior differs.

## Verification

```bash
pnpm --filter @visepanda/ui typecheck
pnpm --filter @visepanda/ui test
pnpm --filter @visepanda/ui build
```

Token changes require contrast checks and screenshots from each consuming surface.
