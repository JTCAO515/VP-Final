# VisePanda V2 Red Gold Design System

状态：Active canonical v1.0
日期：2026-07-09
输入来源：UI-UX-Pro-MAX + frontend-design + impeccable 第二轮评审
明确要求：中国元素；主题使用中国红与烫金。

---

## 0. Final Direction

最终方向：

> **Modern China Concierge Desk**
> 现代中国旅行服务台：宣纸白做底，墨色承载信息，中国红负责行动和方向，烫金负责高级服务、权益、人工帮助和可信背书。

这不是“黑金奢华”，也不是“春节海报”。红金是品牌骨架，但产品仍然要清晰、国际化、可执行。

核心视觉公式：

```
Porcelain / paper surface
+ Ink typography
+ Cinnabar command
+ Foil gold service layer
+ Jade success state
+ Real China travel imagery
```

---

## 1. Design Judgment

### 1.1 What To Emphasize

- 中国红：主 CTA、当前步骤、路线节点、关键提醒。
- 烫金：Trip Pass、Human Help、partner disclosure、精选服务、信任背书。
- 中国元素：印章 chip、票据/行程台账、地铁/支付/餐馆/高铁/城市照片。
- 国际化：英文优先、信息清晰、不要让外国用户觉得像本地中文政务/节庆页面。

### 1.2 What To Avoid

- 大面积红色背景，容易压迫。
- 黑底金字，容易变成夜店/奢侈品/赌场。
- 米黄纸张铺满全站，容易变成廉价攻略博客。
- 龙、灯笼、中国结、水墨山水、仿古纹理。
- 烫金渐变文字。金色应用在边线、chip、图标、标识，不做 gradient text。

---

## 2. Brand Mood

一句物理场景：

> 一个外国游客在上海酒店房间里打开 VisePanda，桌上有护照、地铁票、手机支付页和一张整理好的行程单。界面像一个懂中国现场规则的双语 concierge，能告诉他下一步怎么做。

关键词：

- calm
- prepared
- premium but not luxury
- China-specific
- executable
- trustworthy

---

## 3. Core Motif

### 3.1 Seal Chip

来源：中国印章，但现代化。

用途：

- `Ready`
- `Needs booking`
- `Payment prep`
- `Human help`
- `Complete`

规则：

- 只用纯色、细边框、短文本。
- 不加仿旧纹理。
- 不做毛边、不做水墨。

### 3.2 Foil Edge

来源：烫金票据边、酒店礼宾卡。

用途：

- Trip Pass
- Human Help
- Partner / sponsored disclosure
- Premium service hint

规则：

- 用细金线、金色小面积填充、金色文本。
- 不使用大面积金色背景。
- 不使用闪烁或高光动画。

### 3.3 Route Ledger

来源：行程台账和交通路线。

用途：

- Trip Canvas day/block。
- Progress tracker。
- Skeleton -> detail progression。

规则：

- 只在结构化行程里用。
- 线条轻，信息优先。

---

## 4. Color Tokens

Master tokens use OKLCH. Hex fallback is included for implementation convenience.

```css
:root {
  color-scheme: light;

  /* Surface */
  --vp-bg: oklch(0.995 0.002 90); /* #fefdf9 */
  --vp-app: oklch(0.972 0.006 90); /* #f8f6ee */
  --vp-surface: oklch(1 0 0); /* #ffffff */
  --vp-surface-warm: oklch(0.985 0.007 90); /* #fbfaf5 */
  --vp-surface-red: oklch(0.955 0.025 28); /* soft red wash */
  --vp-surface-gold: oklch(0.945 0.045 82); /* soft foil wash */

  /* Ink */
  --vp-ink: oklch(0.18 0.018 35); /* near black warm ink */
  --vp-ink-soft: oklch(0.34 0.018 35);
  --vp-muted: oklch(0.47 0.014 35);
  --vp-faint: oklch(0.64 0.012 35);

  /* Lines */
  --vp-line: oklch(0.88 0.012 80);
  --vp-line-strong: oklch(0.76 0.018 80);

  /* Brand */
  --vp-china-red: oklch(0.53 0.2 28); /* primary red */
  --vp-china-red-hover: oklch(0.45 0.2 28);
  --vp-china-red-soft: oklch(0.94 0.045 28);

  --vp-foil-gold: oklch(0.68 0.14 82); /* usable foil gold */
  --vp-foil-gold-dark: oklch(0.52 0.12 82);
  --vp-foil-gold-soft: oklch(0.93 0.05 82);

  --vp-jade: oklch(0.48 0.105 158);
  --vp-jade-soft: oklch(0.93 0.035 158);

  --vp-river: oklch(0.49 0.095 225);
  --vp-river-soft: oklch(0.93 0.035 225);

  /* Semantic */
  --vp-primary: var(--vp-china-red);
  --vp-primary-hover: var(--vp-china-red-hover);
  --vp-success: var(--vp-jade);
  --vp-success-soft: var(--vp-jade-soft);
  --vp-warning: var(--vp-foil-gold-dark);
  --vp-warning-soft: var(--vp-foil-gold-soft);
  --vp-danger: var(--vp-china-red);
  --vp-danger-soft: var(--vp-china-red-soft);
  --vp-info: var(--vp-river);
  --vp-info-soft: var(--vp-river-soft);
  --vp-focus: var(--vp-china-red);
}
```

### 4.1 Color Distribution

| Color             | Target share | Use                          |
| ----------------- | -----------: | ---------------------------- |
| Porcelain / white |       60-70% | page and panels              |
| Ink               |       15-20% | text and structure           |
| China red         |        8-12% | primary action, active state |
| Foil gold         |         4-8% | premium/help/disclosure      |
| Jade / river      |         3-6% | semantic success/info        |

If red exceeds 15% of the viewport, the UI will feel aggressive. If gold exceeds 10%, it will feel decorative instead of premium.

---

## 5. Typography

MVP default: system sans.

```css
--vp-font-sans: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
--vp-font-mono: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
```

Optional future editorial pair, not for MVP:

- English headings: a high-quality serif for SEO guides only.
- Chinese fallback: `Noto Sans SC`.

Rules:

- Product UI remains one sans family.
- No calligraphy font.
- No gradient text.
- No negative letter spacing.

Scale:

| Token | Size | Line height | Use                     |
| ----- | ---: | ----------: | ----------------------- |
| xs    | 12px |        16px | metadata, chips         |
| sm    | 14px |        20px | labels, helper          |
| md    | 16px |        24px | body, input             |
| lg    | 18px |        26px | card title              |
| xl    | 22px |        30px | panel title             |
| 2xl   | 28px |        36px | workspace title         |
| 3xl   | 40px |        48px | compact first-screen H1 |

---

## 6. Component Style

### 6.1 Primary Button

Visual:

- Fill: China red.
- Text: white.
- Radius: 8px or pill depending on context.
- Hover: darker red.

Use for:

- Generate
- Plan with Copilot
- Submit human help request

Do not use for:

- Partner link unless user explicitly requested booking/commercial action.

### 6.2 Premium / Help Button

Visual:

- White or gold-soft background.
- Foil-gold border.
- Ink or gold-dark text.

Use for:

- Human Help
- Trip Pass
- Manage paid service
- Partner disclosure card CTA

### 6.3 Seal Chip

Variants:

```css
.sealChip.active {
  background: var(--vp-china-red);
  color: white;
}

.sealChip.gold {
  background: var(--vp-foil-gold-soft);
  border-color: var(--vp-foil-gold);
  color: var(--vp-foil-gold-dark);
}

.sealChip.success {
  background: var(--vp-jade-soft);
  color: var(--vp-jade);
}
```

Rules:

- Short text only.
- Minimum 28px height.
- Not every label is a seal chip. Use it for state, not decoration.

### 6.4 Panel

Visual:

- White surface.
- 1px warm line.
- 8px radius.
- Minimal shadow or none.

Accent option:

- A 1px top rule in red or gold is allowed for major panels.
- No thick side stripes.

### 6.5 Trip Canvas Block

Visual:

- Route ledger line in faint warm line.
- Current block dot in China red.
- Complete block dot in jade.
- Premium/help block can use tiny gold marker.

Actions:

- Primary execution action: red if user-initiated.
- Human/premium action: gold.
- Informational action: river.

---

## 7. Chinese Elements, Safely Applied

Use:

- Seal-like status chips.
- Ticket/ledger structure.
- Thin gold foil edges.
- Real city/travel execution photos.
- Route dots and station-like markers.
- Subtle red current-step markers.

Do not use:

- Dragon, lantern, knot, fan, bamboo, ink mountain as generic decoration.
- Faux parchment texture.
- Gold foil animation.
- Red full-screen hero.
- Chinese characters as decoration if they do not carry user meaning.

---

## 8. Page Application

### 8.1 Copilot Home

Above the fold:

- Brand row.
- `China Travel AI Copilot`.
- One sentence execution promise.
- Prompt input.
- Trip Canvas preview.
- Execution cards.

Visual rhythm:

- Red primary button anchors the first action.
- Gold Human Help card signals premium/service layer.
- Canvas route ledger proves structure.
- Readiness/progress uses seal chips.

### 8.2 Explore

Visual:

- POI cards stay white.
- VP Pick uses gold seal chip.
- Practical risk tags use red-soft or warning-soft sparingly.
- TravelerFit success tags use jade-soft.

### 8.3 Guides

Visual:

- Article layout.
- Red callouts only for critical warnings.
- Gold callouts for paid/partner/service disclosure.
- Checklists use ink and jade, not decorative bullets.

### 8.4 Human Help

Visual:

- Gold service layer.
- Red only for submit/urgent errors.
- Scope and price clarity before CTA.

---

## 9. Accessibility

Non-negotiable:

- Body text contrast >= 4.5:1.
- Gold text cannot be used on white unless it is darkened enough.
- Red buttons use white text.
- Gold filled badges use dark ink text only if fill is pale; saturated gold uses white.
- Focus ring visible, preferably China red or ink depending on background.
- Status always includes text, not only color.

---

## 10. Implementation Guidance

### 10.1 Executable Token Contract

`packages/ui/src/index.ts` is the single executable source for the semantic `--vp-*` token set.
It exports platform-neutral values and `designTokenCss`; Web and Ops inject that CSS once at their
root layouts. Native consumers import the same values directly when a Native surface exists.

Applications may define local aliases such as `--accent` or `--panel` for readability, but aliases
must resolve to `--vp-*` variables. Core red, gold, porcelain, ink, jade, river, line, and primary
text colors must not be copied into `apps/**` stylesheets. `packages/ui` tests enforce WCAG AA text
pairs and scan current product styles for token drift.

The current implementation values deliberately preserve the accepted Web visual baseline:

| Semantic token                            | Value                 | Intended use                               |
| ----------------------------------------- | --------------------- | ------------------------------------------ |
| `--vp-bg` / `--vp-app`                    | `#fefdf9` / `#f8f6ee` | porcelain page and application backgrounds |
| `--vp-surface` / `--vp-surface-warm`      | `#ffffff` / `#fbfaf5` | panels and quiet secondary surfaces        |
| `--vp-china-red` / `--vp-china-red-hover` | `#b92420` / `#a51f24` | primary action and active state            |
| `--vp-foil-gold` / `--vp-foil-gold-dark`  | `#b98522` / `#7a5314` | premium, disclosure, and warning text      |
| `--vp-jade` / `--vp-river`                | `#1f7a5a` / `#2f6f8f` | success and informational state            |

### 10.2 Image Rules

Travel imagery must show an inspectable execution context, have a recorded license/source before
publication, use a fixed crop ratio appropriate to its card, and include meaningful alt text. A
decorative image with no travel task context is not a substitute for product content. Attribution is
stored with the content record or editorial source, never guessed from an image URL.

For #39/#40:

- Use this red-gold theme in `apps/web/src/app/styles.css`.
- Do not add dependencies.
- Do not introduce custom font loading.
- Preserve mock envelope flow.
- Use red/gold through tokens, not hardcoded one-off colors.

Recommended first CSS primitives:

- `.vpButtonPrimary`
- `.vpButtonPremium`
- `.vpPanel`
- `.vpSealChip`
- `.vpRouteLedger`
- `.vpExecutionCard`

Do not create `packages/ui` page components until another surface needs them.

---

## 11. Acceptance Checklist

- [ ] Page clearly reads as VisePanda, not generic AI SaaS.
- [ ] China red appears as primary action and active state.
- [ ] Foil gold appears as service/premium/disclosure layer.
- [ ] Red/gold do not dominate readability.
- [ ] No black-gold luxury theme.
- [ ] No festival/cultural cliché decoration.
- [ ] Product workspace visible in first viewport.
- [ ] 375px / 768px / 1024px / 1440px checked.
- [ ] No horizontal overflow.
- [ ] Focus states visible.
- [ ] Loading/disabled states present.
- [ ] No invented factual data.

---

## 12. Final Recommendation

Use this red-gold theme as the active visual direction.

Compared with the previous `Clear Desk` version, this version is stronger for brand memory. It still keeps the same product discipline: clear workflow, structured canvas, restrained motion, honest commercial disclosure.

The key is proportion:

> White and ink make it usable. Red makes it VisePanda. Gold makes it service-grade.
