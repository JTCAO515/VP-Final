# VisePanda V2 Design System

状态：Draft v0.1
日期：2026-07-09
适用范围：VisePanda V2 Web MVP 优先，后续扩展到 Expo App 与 Ops。
方法来源：使用 UI-UX-Pro-MAX 生成设计系统建议，并按 VisePanda 的产品定位重新裁决。工具建议中的通用紫色 AI / App Store landing 方向不采纳；保留其 accessibility、loading、responsive、low-motion、standard-density 原则。

---

## 1. Design Thesis

VisePanda 不是旅游灵感站，也不是聊天机器人皮肤。它是外国人在中国的执行副驾。

界面必须传达三件事：

1. **可信**：用户要敢把真实行程、支付焦虑、突发问题交给它。
2. **可执行**：每个回答都要落到下一步、路线、准备项、工具卡或人工帮助。
3. **低焦虑**：外国游客在中国的信息负担很高，界面要清楚、安静、可扫描。

一句设计原则：

> Calm operational clarity for China travel.

不追求“酷炫 AI 感”。不做紫粉渐变、发光球、空洞 hero、过度黑金奢华。产品美感来自秩序、信息可信度和场景细节。

---

## 2. Product Personality

| 维度 | 应该像 | 不应该像 |
|---|---|---|
| 信任感 | 机场服务台、现代旅行保险、国际酒店 concierge | 神秘 AI、玄学助手、廉价攻略站 |
| 中国感 | 克制的朱砂红、玉绿色、城市照片、地铁/支付/票务场景 | 龙纹、中国结、过度金色、节庆海报 |
| 智能感 | 结构化状态、清楚的下一步、可解释引用 | 炫技动效、闪烁粒子、会说话但不落地 |
| 商业感 | 场景后置推荐、透明 disclosure | Chat 里插广告、强推预订 |

Core copy tone：

- Direct, calm, practical.
- Prefer verbs: prepare, check, route, translate, book, ask.
- Avoid vague promises: seamless, magical, unforgettable, ultimate.
- Do not say AI can guarantee legal, medical, visa, ticket, or payment outcomes.

---

## 3. Visual Direction

### 3.1 Mood

Light, editorial, operational.

Use real travel execution signals: city street thumbnails, metro maps, payment prep, ticket reservation, restaurant context. Images support trust; they are not decoration.

### 3.2 Composition

Primary desktop layout for Copilot:

```
Top bar: brand + positioning + lightweight nav
Main:    Copilot conversation / Trip canvas
Rail:    Execution cards or progress cards
Footer:  trust, disclosure, guide links when needed
```

The first screen should already be usable. Do not build a marketing-only landing page before the product workspace.

---

## 4. Design Tokens

### 4.1 Color Tokens

Use light mode first. Dark mode is not required for Web MVP.

```css
:root {
  /* Foundation */
  --vp-bg: #f7f8f6;
  --vp-surface: #ffffff;
  --vp-surface-raised: #fbfcfa;
  --vp-ink: #17211f;
  --vp-ink-soft: #40504b;
  --vp-muted: #68746f;
  --vp-subtle: #e9eee9;
  --vp-line: #d9e1dc;

  /* Brand */
  --vp-cinnabar: #c83a32;
  --vp-cinnabar-dark: #982820;
  --vp-jade: #1f7a5a;
  --vp-jade-dark: #15583f;
  --vp-brass: #a97924;
  --vp-brass-soft: #f4ead6;
  --vp-river: #2f6f8f;
  --vp-river-soft: #e2edf2;

  /* Semantic */
  --vp-success: #1f7a5a;
  --vp-success-soft: #e4f2ec;
  --vp-warning: #a97924;
  --vp-warning-soft: #f8efd9;
  --vp-danger: #c83a32;
  --vp-danger-soft: #f8e5e2;
  --vp-info: #2f6f8f;
  --vp-info-soft: #e2edf2;

  /* Focus */
  --vp-focus: #1f7a5a;
}
```

Usage rules:

- `--vp-bg` is the page background, not beige-dominant. Keep white surfaces prominent.
- `--vp-cinnabar` is for primary action, urgency, and active markers. Do not flood large backgrounds with red.
- `--vp-jade` is for readiness, safe completion, and calm progress.
- `--vp-brass` is for editorial highlights, partner disclosure, and paid/help affordances.
- Never rely on red/green alone. Pair semantic color with label text or icon shape.
- Avoid purple-blue AI gradients unless a future sub-brand explicitly introduces them.

### 4.2 Typography

No new font dependency for Web MVP. Use system fonts for speed and reliability.

```css
--vp-font-sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--vp-font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
```

Scale:

| Token | Size | Line height | Use |
|---|---:|---:|---|
| `--text-xs` | 12px | 16px | chips, metadata, labels |
| `--text-sm` | 14px | 20px | secondary copy, cards |
| `--text-md` | 16px | 24px | body, inputs |
| `--text-lg` | 18px | 28px | card headings |
| `--text-xl` | 22px | 30px | section headings |
| `--text-2xl` | 28px | 36px | workspace title |
| `--text-3xl` | 40px | 48px | compact hero / product title |

Rules:

- Base text is 16px minimum.
- Letter spacing stays `0`; do not use negative tracking.
- Headings should be compact, not oversized inside panels.
- Use sentence case for UI labels.
- Long words and city names must wrap without layout breakage.

### 4.3 Spacing

4px base grid.

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
```

Use standard density: content should feel operational, not sparse brochure design.

### 4.4 Radius

```css
--radius-xs: 4px;
--radius-sm: 8px;
--radius-md: 12px;
--radius-pill: 999px;
```

Rules:

- Default cards use 8px.
- Larger workspace panels may use 12px.
- Do not nest card-in-card with heavy borders and shadows.

### 4.5 Elevation

Use borders first, shadows second.

```css
--shadow-sm: 0 1px 2px rgba(23, 33, 31, 0.06);
--shadow-md: 0 14px 32px rgba(23, 33, 31, 0.10);
```

Rules:

- Main panels: border + `--shadow-sm`.
- Floating command surfaces: `--shadow-md`.
- No glow effects.

### 4.6 Motion

Subtle only.

```css
--motion-fast: 140ms;
--motion-base: 180ms;
--motion-slow: 240ms;
--ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
```

Rules:

- Animate opacity, background, border, and transform only.
- Loading states appear for operations over 300ms.
- Respect `prefers-reduced-motion`.
- No scroll choreography in the MVP workspace.

---

## 5. Layout System

### 5.1 Breakpoints

| Token | Width | Behavior |
|---|---:|---|
| `mobile` | 0-767px | One column, Copilot first, canvas second |
| `tablet` | 768-1023px | One column with wider cards or two compact rows |
| `desktop` | 1024-1439px | Two-column workspace |
| `wide` | 1440px+ | Centered max-width, no over-wide text |

Main max width: `1200px`.

### 5.2 Desktop Workspace

Recommended grid:

```css
.workspace {
  display: grid;
  grid-template-columns: minmax(360px, 0.92fr) minmax(420px, 1.08fr);
  gap: 24px;
}
```

Rules:

- Left side is action: Copilot input, prompt examples, progress.
- Right side is state: Trip canvas, day blocks, readiness.
- Execution cards can live below both columns or in a compact rail only if space allows.
- Do not hide core navigation on desktop.

### 5.3 Mobile Workspace

Rules:

- Stack order: brand bar -> Copilot -> progress -> canvas -> execution cards -> links.
- Input remains reachable without horizontal scroll.
- Buttons must be at least 44px tall.
- Avoid sticky elements except the final command bar if later needed.

---

## 6. Components

### 6.1 Top Bar

Purpose: brand trust, not navigation overload.

Content:

- Brand: `VisePanda`
- Positioning: `China Travel AI Copilot`
- Lightweight links: Explore, Payment guide, eSIM guide, Network guide, Human Help

States:

- Current page link has ink text + subtle underline or pill.
- Links must remain keyboard focusable.

### 6.2 Product Title Block

H1:

`China Travel AI Copilot`

Supporting copy:

`Plan the trip, then handle the hard parts: payments, translation, transport, tickets, and human help when you need it.`

Rules:

- This block should not become a full marketing hero.
- Keep it compact enough that the workspace is visible in the first viewport.

### 6.3 Copilot Panel

Elements:

- Conversation transcript
- Prompt input
- Generate button
- Prompt examples
- Connection or mock-state disclosure when applicable

Prompt example:

`Plan my first 2 days in Shanghai with payment and metro tips`

Message states:

| State | Visual |
|---|---|
| User | Right or highlighted surface, strong ink |
| Copilot | Left or neutral surface, readable body |
| System progress | Status row, not a fake chat message |
| Error | Honest red-soft panel with retry action |

Rules:

- Do not generate fake commercial links in Chat.
- If backend is unavailable, say so honestly.
- Disable Generate during loading to prevent double submit.

### 6.4 Progress Tracker

Stages:

1. `Ready`
2. `Building skeleton`
3. `Filling details`
4. `Complete`

Visual:

- Horizontal segmented chips on desktop.
- Wrapped chips on mobile.
- Current stage uses jade or cinnabar depending on action context.

Rules:

- No spinner-only waiting.
- Skeleton and detail completion should have reserved space to avoid layout shift.

### 6.5 Trip Canvas Panel

Purpose: show structured trip state, not prose.

Sections:

- Trip summary
- Readiness / prep items
- Days
- Blocks

Trip block anatomy:

```
Time / status chip
Title
Location or short note
Practical tags
Actions
```

Allowed lightweight status labels:

- `Needs booking`
- `Metro friendly`
- `Payment tip`
- `Language help`
- `Ready`

Rules:

- These are display labels only unless backed by domain fields later.
- Do not invent ratings, prices, or booking availability.
- Missing data should be absent, not replaced with placeholders.

### 6.6 Execution Card

Purpose: connect planning to action.

Examples:

- `Payment prep`
- `Metro-friendly route`
- `Ticket reminder`
- `Translation card`
- `Human help`

Anatomy:

- Category label
- Short title
- One-line value
- CTA

CTA copy examples:

- `Open guide`
- `Prepare now`
- `Ask for help`
- `Copy phrase`

Rules:

- Cards are recommendations, not ads.
- Partner or paid content must have visible disclosure.

### 6.7 Buttons

Primary:

- Background `--vp-cinnabar`
- Text white
- Hover darkens to `--vp-cinnabar-dark`

Secondary:

- White background
- Border `--vp-line`
- Text `--vp-ink`

Tertiary:

- Text button
- Underline or subtle background on hover/focus

Rules:

- Minimum height 44px for primary actions.
- Loading button disables click and changes label.
- Focus ring: 2px `--vp-focus` with 2px offset.

### 6.8 Form Fields

Rules:

- Visible label or accessible name required.
- Placeholder is hint, not label.
- Error text must explain what to do next.
- Input height minimum 44px.

### 6.9 Guide Link

Used for Explore, Payment guide, eSIM guide, Network guide, Human Help.

Visual:

- Small card or pill link.
- Keep it visually secondary to Copilot.

Rules:

- Links must be real anchors.
- No fake disabled nav unless unavailable state is explained.

---

## 7. Imagery and Iconography

### 7.1 Imagery

Use images only when they reveal real context:

- Shanghai street / metro entrance
- Payment QR or cashier context without sensitive data
- Restaurant menu / translation setting
- Train station / ticket gate
- Scenic POI with recognizable place

Rules:

- Fixed aspect ratios to prevent layout shift.
- Always include alt text.
- Use `loading="lazy"` below the fold.
- No decorative gradient blobs, abstract AI waves, or dark blurred stock images.

### 7.2 Icons

No emoji as structural icons.

For current Web MVP constraints:

- Do not add a new icon dependency just for #39/#40.
- If icons are necessary, use small inline SVGs or text labels.
- When `packages/ui` later owns icons, prefer Lucide-style line icons with consistent stroke width.

---

## 8. Accessibility Rules

Non-negotiable:

- Text contrast: 4.5:1 minimum.
- Large text / graphical UI contrast: 3:1 minimum.
- Keyboard access for every interactive element.
- Visible focus on buttons, links, inputs, cards with click behavior.
- Do not encode status by color alone.
- Respect reduced motion.
- No horizontal overflow at 375px.
- Hit targets at least 44px tall/wide for primary controls.

ARIA:

- Use native elements first.
- `button` for actions, `a` for navigation.
- Progress tracker can use `aria-current="step"` for current stage.
- Loading state should use `aria-busy` on the relevant region if async.

---

## 9. Commercial and Trust Rules

VisePanda's commercial model depends on trust. UI must not blur advice and ads.

Rules:

- Chat must not insert commercial recommendations unless the user asks a commerce-intent question.
- Outbound or partner cards must disclose partner status.
- Human Help must say what is human, what is automated, and what is not guaranteed.
- Paid affordances use brass or neutral styling, not aggressive red.
- Never fake urgency such as `Only 2 left` unless backed by real inventory.

---

## 10. Page-Level Guidance

### 10.1 Copilot Home / Workspace

Priority:

1. User can understand the product in 5 seconds.
2. User can type a request immediately.
3. User sees that the output becomes a structured trip, not only chat.
4. User sees execution help: payment, metro, translation, tickets, human help.

Do:

- Show product workspace in first viewport.
- Use one strong primary CTA: Generate / Plan with Copilot.
- Use execution cards as proof of practical value.
- Keep nav light.

Don't:

- Build a full landing hero before the product.
- Use giant decorative screenshots.
- Split into too many competing panels.

### 10.2 Explore

Priority:

- Real POI facts, practical fit, city context.
- Missing data stays hidden.
- Commercial cards disclose partner relation.

Visual:

- Dense but calm cards.
- Tags should be practical: `Easy by metro`, `Good for first-timers`, `May be crowded`.

### 10.3 Guides

Priority:

- Search-intent readability.
- Clear steps and caveats.
- Strong internal links to tools and Copilot.

Visual:

- Article layout, not dashboard layout.
- Use callouts sparingly for warnings and checklists.

### 10.4 Human Help

Priority:

- Trust, scope clarity, price clarity.
- Show status and limitations before payment.

Visual:

- Form-first flow.
- Calm support-service styling, not emergency panic unless the situation is truly urgent.

---

## 11. Implementation Mapping

Immediate Web MVP:

- `apps/web/src/app/styles.css`
  - Define color, type, spacing, radius, motion tokens.
  - Build global body, focus, link, button, card primitives.
- `apps/web/src/app/shell.tsx`
  - Use tokens via class names.
  - Preserve current mock envelope and `applyPatch` flow.
  - Recompose into Copilot + Canvas + Execution cards.

Future shared UI package:

- `packages/ui/src/tokens.ts`
- `packages/ui/src/components/Button.tsx`
- `packages/ui/src/components/Panel.tsx`
- `packages/ui/src/components/StatusChip.tsx`
- `packages/ui/src/components/ExecutionCard.tsx`

Do not create shared components until at least two surfaces need the same primitive. For #39/#40, local CSS is enough.

---

## 12. Acceptance Checklist

Before shipping a VisePanda Web UI PR:

- [ ] 375px, 768px, 1024px, 1440px layouts checked.
- [ ] No horizontal overflow.
- [ ] Primary action is visible and at least 44px tall.
- [ ] Loading state visible for async/mocked generation.
- [ ] Button disabled during generation.
- [ ] Focus states visible by keyboard.
- [ ] Text contrast meets 4.5:1.
- [ ] No emoji used as structural icons.
- [ ] No decorative gradient orbs/blobs.
- [ ] Images have fixed aspect ratio and alt text.
- [ ] Missing factual data is hidden, not invented.
- [ ] Commercial/partner content is disclosed.
- [ ] `prefers-reduced-motion` respected.
- [ ] `pnpm --filter @visepanda/app-web typecheck` passes.
- [ ] `pnpm --filter @visepanda/app-web build` passes.

---

## 13. Anti-Patterns

Do not use:

- Purple/pink AI gradient branding as the main identity.
- Dark luxury black/gold as the default product theme.
- Beige travel-blog dominance.
- Decorative orbs, bokeh blobs, fake glass panels.
- Chat-only interface with no structured canvas.
- Marketing hero that hides the actual product below the fold.
- Fake POI ratings, fake booking availability, fake partner urgency.
- Hidden commercial placement inside Copilot replies.
- Overly cute panda graphics in operational workflows.

---

## 14. First Concrete Application: Issues #39 and #40

Issue #39 should implement:

- Token foundation in `styles.css`.
- Top bar + compact product title.
- Two-column desktop Copilot workspace.
- Mobile stacked layout.
- Visual replacement of the current dark demo shell.

Issue #40 should implement:

- Prompt examples.
- Progress tracker: `Ready / Building skeleton / Filling details / Complete`.
- Execution cards: Payment prep, Metro-friendly route, Human help.
- Loading, disabled, and error states.
- Responsive QA and screenshot evidence.

Both issues must preserve current mock data flow and avoid backend/domain changes.
