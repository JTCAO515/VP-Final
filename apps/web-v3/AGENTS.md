# Web V3 Agent Rules

These rules apply to `apps/web-v3` in addition to the repository root `AGENTS.md`.

- Author all page and component styling with Tailwind CSS v4 utility classes.
- Consume colors only through semantic utilities created by the Red-Gold `@theme inline` bridge,
  such as `bg-brand-gold` or `text-brand-ink`.
- Do not use arbitrary-value classes, hardcoded color literals, inline `style`, JSX `<style>`
  elements, CSS modules, styled-components, or component-local stylesheets.
- A new visual value must first become a reviewed token in `packages/ui`, then enter the `@theme`
  bridge. Do not create a second palette.
- `globals.css` is infrastructure only: Tailwind import, the canonical token CSS import, and the
  `@theme` bridge. It must not contain page or component selectors.
- Do not import implementation files or the legacy component/CSS tree from `apps/web`.
- Missing runtime capabilities must render an honest unavailable state. Do not add inert controls,
  fake success, booking, payment, availability, or Human Help claims.
