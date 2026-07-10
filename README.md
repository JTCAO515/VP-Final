# VisePanda V2 (VP-Final)

> **The execution copilot for foreigners in China.**
> 规划免费，执行可靠，出事有人管。

面向来华外国旅行者的执行副驾：AI 行程规划是免费获客入口，产品的真正核心是「中国现场执行」——支付、网络、语言、交通、预约、突发求助——配付费人工兜底（Human Task）与定制行程询价（lead fee）变现。不是 AI 攻略生成器，不是 OTA，不是工具箱合集。

**本仓库是 VisePanda V2 的唯一开发仓库。** V1（`VP-Codex-Final`）自 2026-07-07 起只收尾不开新功能，V2 Web MVP 公开后冻结（见 [ADR-0001](docs/adr/ADR-0001-repo-and-v1-disposition.md)）。V2 为绿地重构，不继承 V1 任何代码、数据与文档。

---

## 从这里开始（按序读）

| # | 文档 | 作用 |
|---|---|---|
| 1 | [`CONTEXT.md`](CONTEXT.md) | 项目统一语言、边界与真理层级 |
| 2 | [`docs/INDEX.md`](docs/INDEX.md) | 自动生成的当前接手快照、强制阅读顺序和完整知识库索引 |
| 3 | [`docs/architecture/top-level-design.md`](docs/architecture/top-level-design.md) | 总体设计基线：目标、子系统、接口、观测和生命周期门禁 |
| 4 | [`docs/methodology/qian-systems-engineering.md`](docs/methodology/qian-systems-engineering.md) | **钱学森 Skills**：项目永久闭环工程工作流 |
| 5 | [`docs/planning/visepanda-v2-final-architecture.md`](docs/planning/visepanda-v2-final-architecture.md) | **冻结产品基线**：定位、架构、商业与路线图 |
| 6 | [`docs/adr/`](docs/adr/) | 已接受决策；普通 PR 不重复争论 |
| 7 | [Issues](https://github.com/JTCAO515/VP-Final/issues) | 可执行控制动作；按依赖和优先级认领 |

## 当前状态（2026-07-10）

- 已完成：monorepo、核心 domain、Trip/knowledge 数据模型与服务、Web/Ops 可演示骨架、
  红金 Copilot 工作台及基础 CI/evals。
- 当前阶段：**可信演示骨架**，尚非可公开收费的生产 MVP。
- P0 阻塞：真实身份/授权、真实模型与知识检索、Human Task/outbound/telemetry 持久化、
  Ops RBAC、支付证据、rate limit、observability、上线 runbook 与法律页。
- 权威现状审计：[`docs/planning/visepanda-v2-project-review-2026-07-10.md`](docs/planning/visepanda-v2-project-review-2026-07-10.md)。
- Phase 1 Mobile 仍应等待冻结基线的真实用户/Human Task 触发条件。

## 仓库结构

```
packages/domain      唯一真理源：zod schemas + 纯函数（任何功能先改这里）
packages/api-client  由 server router 生成的类型化客户端
packages/ai          提示词档案(4个能力模块起步)、模型路由、输出校验、evals 胶水
packages/ui          设计 token + 跨端基础组件
apps/web             Next.js — SEO + 完整 Web 产品（V2-10 落地真实脚手架）
apps/mobile          Expo RN — 在华执行 App（Phase 1 触发后落地）
apps/server          模块化单体 API：copilot/trip/knowledge/task/commerce/identity/telemetry
apps/ops             运营台：知识编辑、人工任务调度、商家白名单（V2-13 落地）
infra/               migrations、seeds、部署配置
evals/               AI 行为回归：golden set + 跑分脚本（V2-09 落地）
docs/                architecture / modules / standards / constraints / methodology / runbooks / planning
```

## 技术栈

TypeScript 单语言 monorepo（pnpm + turborepo）。Next.js 15（Web/Ops）· Expo RN（App）· Node 模块化单体（Server）· Supabase Postgres + Drizzle + pgvector · Upstash Redis/QStash · Stripe + RevenueCat · PostHog + Sentry · 双供应商 LLM 路由（GPT-5.5 / Claude 互备，廉价档做分类）。

**不做**：原生双端、微服务/K8s、单一 LLM 供应商绑定、Agent 编排框架绑定、OTA 交易闭环、开放商家注册。完整反目标清单见基线 §10。

## 开发硬规则（CI/评审按此执行）

1. **Schema first** — 碰领域模型的功能，先在 `packages/domain` 单独提 PR（schema+纯函数+单测），消费方 PR 在后。
2. **一个 PR 一个边界** — 一个模块 / 一个契约变更 / 一个 UI flow。
3. **AI 永不直接写数据** — 模型输出是类型化信封+Patch，确定性代码校验后应用；Chat 只在显式 commerce intent 下携带商业链接（管道层强制）。
4. **凡钱必进账本** — 任何付费/商业行为必须产出 ledger + telemetry 事件，并带测试。
5. **提示词改动必带 evals** — `packages/ai` 首个 profile 落地后（V2-09），CI evals gate 转为必过。
6. **禁止跨模块碰表** — server 模块间只走显式服务接口。
7. **代码动，文档必动** — 运行 `pnpm docs:check` 和 `pnpm docs:impact -- --base <ref>`。
8. **钱学森 Skills 闭环** — 每项工作明确目标、子系统、观测、偏差、控制动作和复盘证据。
9. **接手状态永远同步** — 每次仓库变更更新 `docs/handoff.json` 并重新生成 Index。

## 路线图（触发条件驱动，非日历）

| 阶段 | 触发条件 | 内容 |
|---|---|---|
| **Phase 0**（进行中，唯一按日历：8 周） | — | Web MVP：Copilot+画布、京沪知识库、三篇 SEO 深度指南、~200 张 programmatic SEO 页、Human Task 表单（创始人 concierge）、outbound 埋点、Ops 三列表页 |
| Phase 1 | 周活 ≥200 真实外国用户 或 Human Task ≥20 单 | Expo App（离线行程+Tools 八件套）、知识库扩 6 城、正式 affiliate 谈判 |
| Phase 2 | 单城定制询价 ≥5 次/月 | Quote 市场（lead fee）、服务者网络、Trip Pass 定价实验 |
| Phase 3 | 月撮合订单 ≥100 且法务实体就绪 | take rate + 平台内分账 |

## Quickstart

```bash
# Node >= 22, pnpm 9 (npm i -g pnpm@9)
pnpm install
pnpm build && pnpm test && pnpm typecheck && pnpm lint   # 全绿才算环境就绪
pnpm docs:index && pnpm docs:check                       # 文档索引与知识库校验
pnpm docs:impact -- --base origin/main                   # 代码与文档同步校验
```

## 协作方式

本项目由 AI coding agent、架构维护者与操作者协作开发。所有工作遵守
[钱学森 Skills](docs/methodology/qian-systems-engineering.md)：目标评审 → 系统分解/接口冻结 →
Issue → 代码/文档/测试 → 观测和偏差校验 → 复盘归档。Issue/PR 模板是强制证据清单，
不是形式化备注。
