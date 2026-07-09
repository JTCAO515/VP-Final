# VisePanda V2 Design System Fusion

状态：Recommended Master v0.1
日期：2026-07-09
输入来源：UI-UX-Pro-MAX + frontend-design + impeccable
适用范围：VisePanda V2 Web MVP，优先指导 Copilot 首页/工作台，后续扩展到 Explore、Guides、Human Help、Ops、Expo App。

---

## 0. Executive Decision

最终设计方向：

> **A calm China travel operations desk.**
> 像一个国际机场里的双语 concierge desk，桌面干净、信息可信、步骤清楚，带一点中国场景里的朱砂印章、玉色通行状态和黄铜服务标识。

核心取舍：

- 采纳 **UI-UX-Pro-MAX** 的系统性：tokens、accessibility、responsive、loading、状态清单。
- 采纳 **frontend-design** 的品牌记忆点：不要做通用 SaaS，不要做紫色 AI，建立 VisePanda 独有的“旅行执行台”视觉。
- 采纳 **impeccable** 的生产约束：纯白/近白产品底、OKLCH 色彩、少装饰、低动效、清晰组件状态、反 AI 味。

最终不采纳：

- 不做紫粉 AI gradient。
- 不做黑金旅游奢华。
- 不做米黄色攻略博客。
- 不做营销 hero 先行。
- 不用熊猫插画承担主品牌表达。

---

## 1. Product Context

VisePanda 的产品定位不是“AI 生成行程”，而是：

> **The execution copilot for foreigners in China.**

用户真正付费和信任的点不是规划，而是中国现场执行：

1. 支付能不能用
2. 有没有网络
3. 能不能沟通
4. 怎么去
5. 票和预约怎么办
6. 出问题谁帮忙

所以设计系统必须把“执行可靠性”放在美学之前。界面要让用户觉得：

- 我知道现在该做什么。
- 我知道哪些事情还没准备好。
- 我知道 AI 给出的内容是结构化的，不是随口一说。
- 我知道哪里是工具、哪里是人工帮助、哪里是商业外跳。

---

## 2. Three Candidate Systems

### 2.1 Candidate A: UI-UX-Pro-MAX

**Primary strength**

系统完整，覆盖 tokens、响应式、可访问性、loading、按钮状态、移动端检查等基础面。适合作为工程验收 checklist。

**Proposed direction**

- Balanced / Modern
- Standard density
- Subtle motion
- Flat Design
- Light theme

**Useful output to keep**

- 375 / 768 / 1024 / 1440 断点检查。
- 4.5:1 contrast。
- loading 超过 300ms 要反馈。
- button loading disabled。
- no horizontal overflow。
- no emoji as structural icons。
- skeleton reserve space。

**Problems**

- 初始工具输出偏通用 App landing。
- 默认给出 purple / pink AI palette，不适合 VisePanda。
- 过于像“能下载 App 的营销页”，而不是“旅行执行工作台”。

**Verdict**

作为系统工程和 QA 骨架保留，不作为品牌视觉方向。

---

### 2.2 Candidate B: frontend-design

**Primary strength**

能逼迫产品脱离普通 AI SaaS 模板，找到更有记忆点的视觉概念。

**Proposed direction: Stamped Journey Desk**

一个“旅行执行台”界面：

- Copilot 像 concierge desk 的工作台。
- Trip Canvas 像干净的行程夹板。
- 关键状态像清晰的通行章。
- 执行建议像旅行文件里的贴签。
- 中国感来自朱砂、玉、黄铜、城市照片和真实执行场景，而不是传统装饰图案。

**Signature motif**

`stamp + route ledger`

- 当前阶段用一个紧凑的“stamp chip”表达：Ready、Building、Complete。
- 行程 block 用细 route line 串联，而不是一堆同质卡片。
- Execution cards 像文件夹贴签，短、硬、可行动。

**Useful output to keep**

- 要有一个用户能记住的视觉锚点。
- 不用默认 Inter/紫色/卡片网格套路来冒充产品设计。
- 画面应当表达“来华执行”，不是通用 travel inspiration。

**Risks**

- 如果过度使用印章、路线、贴签，会变成主题装饰。
- 如果引入太多字体或纹理，会增加实现成本并影响 Web MVP 的速度。
- 如果为了“特别”改造标准控件，会牺牲信任和效率。

**Verdict**

保留一个克制的 signature motif，但不让它吞掉产品 UI。

---

### 2.3 Candidate C: impeccable

**Primary strength**

对生产级产品 UI 的判断最硬：少装饰、状态齐全、contrast 正确、拒绝 AI 味和过度圆角。

**Physical scene**

一个外国旅客在酒店房间或机场休息区打开 VisePanda，想确认今天怎么走、怎么付钱、出了问题怎么求助。环境光正常，用户紧张但不想被“酷炫 AI”打扰。

**Proposed direction**

- Product UI first。
- Pure white / near-white app surface。
- Restrained color strategy。
- One type family。
- Fixed type scale。
- Radius capped。
- Cards only where they are the best affordance。
- Motion conveys state only。

**Useful output to keep**

- 产品 UI 可以使用系统字体，熟悉是优点。
- Accent 只用于 primary actions、current selection、state。
- 所有交互组件都要有 default / hover / focus / active / disabled / loading / error。
- 不用 modal 做第一反应。
- 避免 nested cards、ghost-card、过度圆角、decorative grid。

**Risks**

- 如果完全按 impeccable 的克制走，VisePanda 可能变得像任意 B2B 工具。
- 需要从 frontend-design 候选中保留少量品牌记忆点。

**Verdict**

作为最终实现质量的硬约束采用。

---

## 3. Review Matrix

| Criterion | UI-UX-Pro-MAX | frontend-design | impeccable | Final decision |
|---|---:|---:|---:|---|
| 系统完整度 | 5 | 3 | 5 | 采 UI-UX + impeccable |
| 品牌差异化 | 2 | 5 | 3 | 采 frontend-design 的单一 motif |
| 产品可信度 | 4 | 3 | 5 | 采 impeccable |
| 实现可控性 | 4 | 3 | 5 | 采 impeccable |
| 可访问性 | 5 | 3 | 5 | 采 UI-UX + impeccable |
| 避免 AI 模板感 | 3 | 5 | 5 | 采 frontend-design + impeccable |
| 商业化适配 | 3 | 4 | 5 | 采 impeccable 的 disclosure 规则 |
| Copilot 工作台适配 | 4 | 4 | 5 | 融合 |

最终公式：

> impeccable 的产品 UI 纪律 + UI-UX-Pro-MAX 的验收清单 + frontend-design 的“Stamped Journey Desk”记忆点。

---

## 4. Master Design Principles

### 4.1 Trust Before Delight

任何视觉元素如果降低可读性、可解释性或可操作性，就删掉。

### 4.2 Execution Over Inspiration

VisePanda 展示的是“下一步怎么做”，不是“旅行多美”。

### 4.3 Structured AI, Not Chat Magic

Copilot 的回答必须视觉上连接到结构化 Trip Canvas、execution cards、tools、human help。不要让用户感觉 AI 只是输出长段文字。

### 4.4 China Context Without Tourist Cliche

中国感来自真实场景和克制色彩：地铁、支付、餐馆、票务、城市街道。不要靠龙、灯笼、熊猫、书法纹理来表达。

### 4.5 Commercial Transparency

商业入口必须后置、透明、可识别。不要把 partner link 伪装成中立建议。

---

## 5. Final Visual Identity

### 5.1 Name

**Clear Desk**

解释：用户打开 VisePanda 时，像坐到一个干净、有条理、懂中国现场规则的服务台前。Clear 表示清晰、通关、放心；Desk 表示执行、处理、有人管。

### 5.2 Signature Motif

**Stamp chip + route ledger**

用法：

- Stamp chip：用于关键状态，如 `Ready`、`Needs booking`、`Payment prep`、`Human help`。
- Route ledger：用于 Trip Canvas day/block 的纵向节奏，像行程台账，不像营销卡片堆。

限制：

- Stamp chip 不做仿旧纹理。
- Route line 只在行程结构中使用，不作为全站装饰。
- 不使用印章图案、水墨纸张、斜纹背景。

---

## 6. Color System

Color strategy: **Restrained product UI with 3 named accents**.

Use OKLCH as the master token format. Hex can be generated later only as fallback.

```css
:root {
  color-scheme: light;

  /* Base */
  --vp-bg: oklch(1 0 0);
  --vp-app: oklch(0.975 0.006 165);
  --vp-surface: oklch(1 0 0);
  --vp-surface-subtle: oklch(0.965 0.008 165);
  --vp-surface-raised: oklch(0.992 0.002 165);

  /* Text */
  --vp-ink: oklch(0.19 0.018 170);
  --vp-ink-soft: oklch(0.35 0.018 170);
  --vp-muted: oklch(0.47 0.015 170);
  --vp-faint: oklch(0.62 0.012 170);

  /* Borders */
  --vp-line: oklch(0.88 0.01 165);
  --vp-line-strong: oklch(0.78 0.014 165);

  /* Brand accents */
  --vp-cinnabar: oklch(0.56 0.18 29);
  --vp-cinnabar-hover: oklch(0.48 0.18 29);
  --vp-cinnabar-soft: oklch(0.94 0.035 29);

  --vp-jade: oklch(0.48 0.105 160);
  --vp-jade-hover: oklch(0.40 0.105 160);
  --vp-jade-soft: oklch(0.93 0.035 160);

  --vp-brass: oklch(0.62 0.12 78);
  --vp-brass-hover: oklch(0.52 0.12 78);
  --vp-brass-soft: oklch(0.93 0.04 78);

  --vp-river: oklch(0.50 0.10 225);
  --vp-river-soft: oklch(0.93 0.035 225);

  /* Semantics */
  --vp-success: var(--vp-jade);
  --vp-success-soft: var(--vp-jade-soft);
  --vp-warning: var(--vp-brass);
  --vp-warning-soft: var(--vp-brass-soft);
  --vp-danger: var(--vp-cinnabar);
  --vp-danger-soft: var(--vp-cinnabar-soft);
  --vp-info: var(--vp-river);
  --vp-info-soft: var(--vp-river-soft);

  /* Focus */
  --vp-focus: oklch(0.48 0.105 160);
}
```

### 6.1 Color Usage

| Role | Use | Do not use |
|---|---|---|
| Cinnabar | Primary CTA, active stage, urgent but controlled status | Large background fills, decorative accents everywhere |
| Jade | Success, readiness, safe progress, completed prep | Primary commercial CTA |
| Brass | Paid help, partner disclosure, editorial highlight | Warning-only color with no label |
| River | Informational links, transport, route context | Generic blue SaaS identity |
| Pure white | Main product surface | Warm beige travel blog |

### 6.2 Contrast Rules

- Body text vs background target: 7:1 where possible, 4.5:1 minimum.
- Text on saturated fills uses white or near-white.
- Muted text must still be readable, not decorative gray.
- Status cannot be color-only. Always include text.

---

## 7. Typography

Final decision for MVP: **one system sans stack**.

Reason:

- Product UI needs speed, clarity, and low implementation overhead.
- Fonts should not become the brand before the product proves the workflow.
- Later SEO/editorial pages may introduce a distinct serif, but Copilot workspace should stay task-first.

```css
--vp-font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--vp-font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
```

### 7.1 Type Scale

Fixed scale, no viewport-driven font sizes for product UI.

| Token | Size | Line height | Weight | Use |
|---|---:|---:|---:|---|
| `--vp-text-xs` | 12px | 16px | 500 | metadata, compact chips |
| `--vp-text-sm` | 14px | 20px | 400/600 | cards, labels, helper text |
| `--vp-text-md` | 16px | 24px | 400 | body, inputs |
| `--vp-text-lg` | 18px | 26px | 600 | card heading |
| `--vp-text-xl` | 22px | 30px | 650 | panel heading |
| `--vp-text-2xl` | 28px | 36px | 700 | workspace title |
| `--vp-text-3xl` | 40px | 48px | 750 | compact first-screen H1 |

Rules:

- Letter spacing is `0`.
- Do not use tiny uppercase eyebrow labels as a repeated scaffold.
- Use `text-wrap: balance` for h1-h3.
- Body prose max width: 65-75ch.

---

## 8. Spacing, Radius, Shadow

### 8.1 Spacing

```css
--vp-space-1: 4px;
--vp-space-2: 8px;
--vp-space-3: 12px;
--vp-space-4: 16px;
--vp-space-5: 20px;
--vp-space-6: 24px;
--vp-space-8: 32px;
--vp-space-10: 40px;
--vp-space-12: 48px;
--vp-space-16: 64px;
```

Density:

- Product workspace: standard to slightly dense.
- SEO guides: more generous line height and section spacing.
- Ops: dense, table-first.

### 8.2 Radius

```css
--vp-radius-xs: 4px;
--vp-radius-sm: 8px;
--vp-radius-md: 12px;
--vp-radius-pill: 999px;
```

Rules:

- Cards default to 8px.
- Large panels can use 12px.
- Inputs and buttons use 8px or pill depending on shape.
- No 24px+ card radius.

### 8.3 Shadow

```css
--vp-shadow-border: 0 0 0 1px var(--vp-line);
--vp-shadow-float: 0 8px 18px oklch(0.19 0.018 170 / 0.08);
--vp-shadow-modal: 0 24px 64px oklch(0.19 0.018 170 / 0.16);
```

Rules:

- Prefer borders over shadows.
- Do not combine 1px border with giant soft shadow on every card.
- No glow.

---

## 9. Motion

```css
--vp-motion-fast: 140ms;
--vp-motion-base: 180ms;
--vp-motion-slow: 240ms;
--vp-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
--vp-ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
```

Use motion for:

- Button hover and press.
- Progress stage change.
- Skeleton to detail transition.
- Toast or inline feedback.
- Drawer/popover open if later needed.

Do not use motion for:

- Decorative page-load choreography.
- Floating background decoration.
- Scroll-jacking.

Reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 10. Layout System

### 10.1 Breakpoints

| Name | Width | Rule |
|---|---:|---|
| Mobile | 0-767px | One column, Copilot first |
| Tablet | 768-1023px | One column, wider cards |
| Desktop | 1024-1439px | Two-column workspace |
| Wide | 1440px+ | Centered max-width |

Main max width: `1200px`.

### 10.2 Copilot Workspace Layout

Desktop:

```css
.vpWorkspace {
  display: grid;
  grid-template-columns: minmax(360px, 0.92fr) minmax(420px, 1.08fr);
  gap: var(--vp-space-6);
  max-width: 1200px;
  margin: 0 auto;
}
```

Mobile order:

1. Top bar
2. Product title
3. Copilot input and transcript
4. Progress tracker
5. Trip canvas
6. Execution cards
7. Guide links

Rules:

- No horizontal scroll at 375px.
- Product workspace must be visible in first viewport.
- Do not place a marketing-only hero before the workspace.

---

## 11. Component System

### 11.1 Top Bar

Content:

- `VisePanda`
- `China Travel AI Copilot`
- Links: Explore, Payment guide, eSIM guide, Network guide, Human Help

Rules:

- Navigation stays lightweight.
- Current page state is visible.
- Links are real anchors.
- On mobile, wrap links or collapse to a compact row. Do not hide essential nav without replacement.

### 11.2 Product Title Block

H1:

`China Travel AI Copilot`

Supporting copy:

`Plan the trip, then handle the hard parts: payments, translation, transport, tickets, and human help when you need it.`

Rules:

- Title block is compact.
- Workspace begins in first viewport.
- No giant empty hero.

### 11.3 Copilot Panel

Purpose:

The user's command center.

Required parts:

- Conversation transcript.
- Prompt examples.
- Text input.
- Primary generate button.
- Honest connection/mock disclosure when relevant.

States:

| State | Requirement |
|---|---|
| Ready | Input enabled, primary CTA clear |
| Loading | Button disabled, progress visible |
| Success | Assistant answer and canvas update visible |
| Error | Honest message with retry path |
| Empty | Example prompts teach what to ask |

Rules:

- Second-round skeleton/detail updates should not create fake extra chat bubbles unless the contract says so.
- No partner links unless commerce intent exists.
- User can edit prompt before sending.

### 11.4 Progress Tracker

Stages:

1. `Ready`
2. `Building skeleton`
3. `Filling details`
4. `Complete`

Visual:

- Stamp chips, not a bulky wizard.
- Current chip uses cinnabar or jade.
- Completed chips use jade-soft.
- Pending chips use neutral.

Accessibility:

- Use `aria-current="step"` on current stage.
- Do not rely on color alone.

### 11.5 Trip Canvas

Purpose:

Show structured travel state. It is the proof that Copilot produces executable structure.

Sections:

- Trip summary.
- Readiness.
- Days.
- Blocks.
- Execution tags.

Block anatomy:

```
time/status
title
location or short description
practical tags
actions
```

Route ledger motif:

- Use a subtle vertical line only inside day/block lists.
- Use small dots for current or completed blocks.
- Do not use decorative map lines elsewhere.

Allowed display tags:

- `Ready`
- `Needs booking`
- `Payment tip`
- `Metro friendly`
- `Language help`
- `Human help available`

Rules:

- Missing data is hidden.
- Never invent ratings, review counts, booking availability, or prices.
- Canvas state must visually differ from chat prose.

### 11.6 Execution Card

Purpose:

Bridge planning to execution.

Examples:

- Payment prep
- Metro-friendly route
- Ticket reminder
- Translation card
- Human help

Anatomy:

```
category label
title
one-line value
CTA
optional disclosure
```

Rules:

- Cards are not generic feature cards.
- Every execution card needs a clear action.
- Partner content gets visible disclosure.
- Human Help cards must not imply guaranteed outcome.

### 11.7 Buttons

Primary:

- Fill: cinnabar.
- Text: white.
- Use for one main action per region.

Secondary:

- Surface fill.
- Border line.
- Ink text.

Tertiary:

- Text only or subtle background on hover.

States:

- default
- hover
- focus
- active
- disabled
- loading

Rules:

- Minimum height: 44px.
- Focus ring always visible.
- Loading disables repeat click.

### 11.8 Form Fields

Rules:

- Visible label or accessible name.
- Placeholder is hint, not label.
- Minimum height 44px.
- Error copy says what to do next.
- Avoid custom form controls unless necessary.

### 11.9 Status Chip

Variants:

- Neutral
- Active
- Success
- Warning
- Danger
- Paid/help

Rules:

- Pill shape allowed.
- Text must be short.
- Include accessible label when meaning is not obvious.

### 11.10 Empty State

Good empty states:

- teach the first action
- show one example
- avoid fake data

Bad empty states:

- blank panels
- generic “Nothing here”
- fake trip data unless explicitly marked demo/mock

---

## 12. Imagery and Content

### 12.1 Imagery

Use real, inspectable context:

- metro entrance
- payment counter / QR payment context
- restaurant menu
- station or airport
- recognizable city street
- ticket gate

Rules:

- Use fixed aspect ratios.
- Add alt text.
- Lazy-load below fold.
- Avoid dark blurred stock photos.
- Avoid purely decorative illustrations.

### 12.2 Icons

For current Web MVP:

- Do not add a new icon dependency just for visual polish.
- Use text labels where sufficient.
- If icons are needed later, use one line-icon family, preferably Lucide-style.

Rules:

- No emoji as structural icons.
- Consistent stroke width.
- Buttons with icons still need accessible labels.

---

## 13. Surface Guidance

### 13.1 Copilot Home

Goal:

User understands VisePanda in 5 seconds and can immediately try a useful prompt.

Must show:

- H1 and practical supporting copy.
- Prompt input.
- Structured canvas.
- Progress states.
- Execution cards.

Do not show:

- long marketing hero
- feature grid before product
- giant device mockup
- fake statistics

### 13.2 Explore

Goal:

Practical discovery, not inspiration browsing.

Rules:

- Show only known facts.
- Use traveler-fit tags when derivable.
- Do not show blank rating/price placeholders.
- Partner links disclose.

### 13.3 Guides

Goal:

SEO acquisition and pre-trip preparation.

Rules:

- Article readability over app density.
- Clear step sections.
- Warnings use semantic callouts, not panic styling.
- Link back to Copilot and Tools when relevant.

### 13.4 Human Help

Goal:

Make scope, price, and human involvement clear.

Rules:

- Form-first.
- No overpromising.
- Explain what happens next.
- Paid status uses brass, not aggressive red.

### 13.5 Ops

Goal:

Internal throughput and accuracy.

Rules:

- Dense tables are allowed.
- Use stronger status vocabulary.
- Prioritize keyboard workflows.
- No marketing visuals.

---

## 14. Accessibility and Quality Bar

Every UI PR must pass:

- [ ] Body text contrast >= 4.5:1, target 7:1.
- [ ] Interactive controls keyboard reachable.
- [ ] Visible focus state.
- [ ] 44px minimum primary target height.
- [ ] Loading feedback for >300ms work.
- [ ] Disabled state prevents double submit.
- [ ] Error states include recovery action.
- [ ] No horizontal overflow at 375px.
- [ ] Responsive checked at 375, 768, 1024, 1440.
- [ ] `prefers-reduced-motion` respected.
- [ ] Missing factual data hidden, not invented.
- [ ] Partner/commercial content disclosed.
- [ ] Images have dimensions/aspect ratio and alt text.
- [ ] No structural emoji icons.

---

## 15. Implementation Plan

### Phase DS-01: Local Web Tokens

Scope:

- `apps/web/src/app/styles.css`

Tasks:

- Replace dark MVP variables with final OKLCH tokens.
- Add focus, button, panel, chip, form primitives.
- Add reduced-motion rule.
- Keep implementation local until reuse pressure exists.

### Phase DS-02: Copilot Workspace

Scope:

- `apps/web/src/app/shell.tsx`
- `apps/web/src/app/styles.css`

Tasks:

- Recompose page into top bar, title block, Copilot panel, Trip Canvas, execution cards.
- Preserve current mock envelope and `applyPatch` flow.
- Add progress tracker with four stages.
- Add mobile stack.

### Phase DS-03: Shared UI Package

Trigger:

Only after at least two surfaces reuse the same primitives.

Scope:

- `packages/ui`

Candidate exports:

- tokens
- Button
- Panel
- StatusChip
- ExecutionCard
- EmptyState
- FormField

Do not prematurely build a full component library.

---

## 16. Anti-Patterns

Hard bans:

- Purple/pink AI gradient identity.
- Cream/sand/beige dominant body background.
- Black/gold luxury travel theme.
- Decorative orbs, bokeh blobs, glassmorphism.
- Fake search boxes or fake controls.
- Nested cards.
- Over-rounded 24px+ cards.
- Gradient text.
- Side-stripe card borders.
- Repeated uppercase eyebrow labels.
- Giant hero before product workspace.
- Panda/cartoon mascot as operational UI.
- Fake ratings, fake price, fake booking availability.
- Chat-inserted ads without commerce intent.

---

## 17. Acceptance for Issues #39 and #40

Issue #39 should implement:

- Final token foundation.
- Clear Desk visual identity.
- Compact product title.
- Top bar with lightweight nav.
- Desktop two-column workspace.
- Mobile stacked workspace.
- Removal of current dark demo look.

Issue #40 should implement:

- Prompt examples.
- Progress tracker.
- Skeleton/detail visual state.
- Execution cards.
- Disabled/loading states.
- Responsive QA.

Both issues:

- Must not change backend, domain, API, or routing contracts.
- Must not add design dependencies unless justified in PR.
- Must keep the page usable in the first viewport.

---

## 18. One-Screen North Star

When the homepage loads, the user should see:

1. `VisePanda`
2. `China Travel AI Copilot`
3. A prompt input with a realistic China travel request.
4. A trip canvas showing structured output.
5. Execution cards proving practical value: payment, metro, tickets, human help.
6. A calm, bright interface that feels trustworthy enough to use while traveling.

If the page instead looks like a generic AI landing page, the design failed.
