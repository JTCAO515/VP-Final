# VisePanda V3

> **AI planning and execution workspace for independent travel in China.**
>
> 面向来华外国自由行游客的 AI 规划与执行工作台。

VisePanda V3 帮助旅行者把“想去中国”推进到“下一步能真正执行”。VisePanda Chatbot
理解城市、日期、兴趣、节奏与现场变化；Trip Canvas 保存并展示当前行程、地点、准备状态和
可用执行动作。产品围绕一个连续闭环构建：

```text
Planner = discover and decide
Canvas  = remember and manage
Today   = execute and recover
```

VisePanda 不是 OTA、自动预订服务或一次性攻略生成器。模型可以提出候选与变更建议，但不能
绕过事实资格、用户确认、确定性校验、TripPatch、审计和持久化边界直接修改行程。

**VisePanda V3 是本仓库当前的公共版本名称。** 版本名称不代表所有 V3 规划能力已经上线；
下方状态表和自动生成的 [`docs/INDEX.md`](docs/INDEX.md) 才是交付成熟度依据。

## 当前状态

| 能力                    | 状态                      | 当前事实                                                                                                                 |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| V3 Early Access Shell   | **Implemented · Preview** | 独立 Next.js App Router 应用、Red-Gold 视觉系统、响应式页面、FAQ 与诚实错误状态已经合并并部署到 Vercel Preview。         |
| V3 多语言 UI            | **Implemented · Preview** | English、中文、Español、Русский、العربية 已纳入 UI catalog；Arabic 支持 RTL。                                            |
| 共享服务端入口          | **Implemented**           | `apps/web` 与 `apps/web-v3` 复用同一 Web composition 和 Early Access HTTP handler；V3 没有复制第二套业务后端。           |
| V3 Preview 持久化与邮件 | **Unavailable**           | Preview 没有 database、Redis 或 Resend 环境变量；提交会诚实返回 `EARLY_ACCESS_UNAVAILABLE`，由 OA-033 管理后续外部配置。 |
| Planner                 | **Next · #556**           | 静态体验与诚实空态已进入 ready；真实候选、地图或 Trip 写入不在该切片内。                                                 |
| Canvas / Today          | **Planned**               | 只读 Trip 投影、确认式 Patch、Next Action 与恢复体验仍由 #559–#561 约束，尚未交付。                                      |
| V3 Production cutover   | **Not started**           | 当前 Production 与回滚资产仍是 `apps/web`；域名、路由矩阵、监控和回滚演练由 #562 单独验收。                              |

实时状态、阻塞项和下一项控制动作以
[`docs/INDEX.md`](docs/INDEX.md)、
[`docs/handoff.json`](docs/handoff.json)、
[`operator-action-register.md`](docs/governance/operator-action-register.md)
和当前 [GitHub Issues](https://github.com/JTCAO515/VP-Final/issues) 为准。

## 可访问环境

| 环境              | 地址                                                                                       | 所有者与边界                                                           |
| ----------------- | ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Public Production | [go2china.space](https://www.go2china.space)                                               | `apps/web`；当前公开产品与 V3 切流前回滚资产。                         |
| V3 Preview        | [vp-final-web-v3 Preview](https://vp-final-web-v3-wito9sdxy-jtcao515s-projects.vercel.app) | `apps/web-v3`；独立、受保护、noindex 的 Vercel Preview，无自定义域名。 |

V3 Preview 的页面可用于视觉与交互验收，但当前不构成生产 Early Access 注册或邮件交付证据。

## V3 产品结构

- **VisePanda Chatbot**：唯一用户侧对话式 AI 界面，负责规划、解释、候选建议、执行编排和恢复。
- **Planner**：发现与决策；只显示有明确来源、资格、缺失或不可用状态的候选，不直接写入 Trip。
- **Trip Canvas**：记忆与管理；呈现唯一的 owner-scoped Trip、准备状态、Saved 与待确认变更。
- **Today**：执行与恢复；显示 Today、Next 和最多一个符合资格的实际动作，证据不足时给出安全替代与恢复路径。
- **Execution Facts**：带来源、置信度、适用范围和时效的事实层，优先服务 Payment、Show to Local、Entry / Booking、Translate / Communicate、Network 与 Rescue / Human Help。

## V3 技术栈

V3 前端位于 `apps/web-v3`，与现有服务端和 Domain 权威共用一个 TypeScript monorepo。

| 层             | 技术与约束                                                                                                           |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Frontend       | Next.js 15.5.21 App Router、React 19.2.7、TypeScript                                                                 |
| Styling        | Tailwind CSS 4.3.3；通过 `@theme inline` 桥接 `packages/ui/tokens.css` 中的 VisePanda Red-Gold tokens                |
| Workspace      | pnpm 9.15.9、Turborepo 2、Node.js 22+                                                                                |
| Contracts      | Zod domain schemas、typed service interfaces、TripPatch、fail-closed runtime modes                                   |
| Server         | Node modular monolith；身份、Trip、Knowledge、Early Access、Telemetry、Commerce 与 Human Help 由 server modules 持有 |
| Data / Runtime | Supabase Postgres、Drizzle、pgvector、Upstash Redis/QStash、Vercel；外部配置缺失时不得伪造成功                       |

V3 新页面和组件必须使用 Tailwind CSS v4 utility classes。颜色只能引用 `@theme` 桥接后的
VisePanda token；禁止 arbitrary-value color、行内 `style`、JSX `<style>` 和组件本地颜色字面量。
旧 `apps/web` 按需渐进维护，不要求一次性迁移。

## Monorepo

```text
apps/web-v3         VisePanda V3 traveler experience and thin Next.js adapters
apps/web            current public Production and pre-cutover rollback asset
apps/server         shared modular-monolith services and Web composition
apps/ops            private operations console
apps/mobile         Expo controlled-preview surface
packages/domain     canonical schemas and deterministic business rules
packages/api-client typed clients generated from accepted server contracts
packages/ai         provider-independent model routing, validation and eval glue
packages/ui         canonical Red-Gold tokens and cross-surface primitives
infra               append-only migrations, seeds and deployment configuration
evals               AI safety and behavior regression suites
docs                architecture, decisions, modules, constraints, plans and runbooks
```

`apps/web-v3` 只拥有体验层和薄框架适配器。它不能复制 `apps/web` 的服务端 composition、直接查询
server-owned 表、另建 Auth/数据库/模型 Router，或绕过共享错误语义。

## 本地启动 V3

前置要求：Node.js 22+ 与 pnpm 9.15.9。

```bash
pnpm install --frozen-lockfile
pnpm --filter @visepanda/app-web-v3 dev
```

默认开发地址由 Next.js 输出。未提供外部运行时配置时，页面应保持可访问，Early Access 提交应返回
诚实不可用状态；这不是本地环境故障。

V3 聚焦检查：

```bash
pnpm --filter @visepanda/app-web-v3 typecheck
pnpm --filter @visepanda/app-web-v3 test
pnpm --filter @visepanda/app-web-v3 lint
pnpm --filter @visepanda/app-web-v3 build
```

完整仓库门禁：

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm evals
pnpm build
pnpm docs:index
pnpm docs:check
pnpm docs:impact -- --base origin/main
```

## 当前工作入口

- [#551 — VisePanda V3 Web 重构总控](https://github.com/JTCAO515/VP-Final/issues/551)
- [#556 — Planner 静态体验与诚实空态](https://github.com/JTCAO515/VP-Final/issues/556)
- [V3 Web plan](docs/planning/visepanda-v3-web-plan.md)
- [Web V3 module truth](docs/modules/web-v3.md)
- [ADR-0025 — V3 experience-layer boundary](docs/adr/ADR-0025-vp-v3-web-experience-layer.md)
- [ADR-0026 — VisePanda V3 public release naming](docs/adr/ADR-0026-visepanda-v3-public-release-name.md)

## 阅读顺序

1. [`CONTEXT.md`](CONTEXT.md) — 产品定义、统一术语与事实权威顺序。
2. [`docs/INDEX.md`](docs/INDEX.md) — 当前 handoff、成熟度、阻塞项与完整文档索引。
3. [`docs/architecture/top-level-design.md`](docs/architecture/top-level-design.md) — 总体设计、子系统、接口与门禁。
4. [`docs/adr/`](docs/adr/) — 已接受且不可在普通 PR 中重复争论的决策。
5. [`docs/modules/web-v3.md`](docs/modules/web-v3.md) — V3 已实现事实、边界与下一步。
6. [GitHub Issues](https://github.com/JTCAO515/VP-Final/issues) — 可执行工作与依赖关系。

## 工程原则

1. Schema first；跨消费者的领域契约先在 `packages/domain` 冻结。
2. 一个 PR 只改变一个可评审边界，不捆绑顺手重构。
3. AI 输出是候选或类型化 Patch，不是事实或直接数据写入。
4. 缺配置、缺证据、缺权限或 provider 失败时必须 fail closed。
5. 支付、合作伙伴跳转、Human Help 和其他商业动作必须有账本、审计、披露与真实运营证据。
6. 页面存在、Preview Ready 或代码合并都不等于生产能力已经成立。
7. 代码、文档、Issue、测试、部署证据和回滚必须保持可追溯。

本项目由 operator、架构维护者与 AI coding agents 协作。所有公共能力声明以可复现证据为准；
规划、placeholder、Preview 与 Production 必须明确区分。
