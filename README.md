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
| 5 | [`docs/governance/composite-engineering-baseline.md`](docs/governance/composite-engineering-baseline.md) | 钱学森 + Matt 文档即代码 + Karpathy 编码纪律的统一基线 |
| 6 | [`docs/planning/visepanda-v2-final-architecture.md`](docs/planning/visepanda-v2-final-architecture.md) | **冻结产品基线**：定位、架构、商业与路线图 |
| 7 | [`docs/adr/`](docs/adr/) | 已接受决策；普通 PR 不重复争论 |
| 8 | [Issues](https://github.com/JTCAO515/VP-Final/issues) | 可执行控制动作；按依赖和优先级认领 |

## 当前状态（2026-08-17）

- 已完成：monorepo、核心 Domain、持久化 Trip/Knowledge/Human Task/Outbound/Telemetry 边界、
  真实 Provider 路由、成本与产品事件记录、匿名与可信 IP 保护、法律页、Ops RBAC、
  知识审核工作流、私有 Ops 图片运行时、Web 多语言 UI，以及基础 CI/evals。
- 当前阶段：**Phase 0/1 的生产加固与受控预览**。公开 Web 与 Ops 具备受限但真实的运行时；
  所有缺失配置均诚实不可用，绝不以 mock 或占位成功替代。
- 当前最大产品缺口：经过人工核实、可展示的执行事实仍很少；这不是代码问题，必须按
  [知识事实审核流程](docs/runbooks/knowledge-fact-review.md)逐条录入、复核和续期。
- 外部激活仍受事实门槛约束：Stripe 收款、批准合作伙伴跳转、运营服务、公开图片交付、
  VisePod 设备服务与 Phase 2+ 商业化均未因仓库代码而自动上线。
- **权威现状**：先读自动生成的 [`docs/INDEX.md`](docs/INDEX.md) handoff 快照、
  [`docs/governance/operator-action-register.md`](docs/governance/operator-action-register.md) 和
  当前 GitHub Issues；历史评审文档仅作为当日证据，不作为实时状态来源。

## 仓库结构

```
packages/domain      唯一真理源：zod schemas + 纯函数（任何功能先改这里）
packages/api-client  由 server router 生成的类型化客户端
packages/ai          提示词档案、环境配置化模型路由、输出校验、evals 胶水
packages/ui          设计 token + 跨端基础组件
apps/web             Next.js — 公开产品、VisePanda 工作台、SEO 与安全运行时
apps/mobile          Expo RN — 受控预览的在华执行基础与 Phase 1 扩展面
apps/server          模块化单体 API：copilot/trip/knowledge/task/commerce/identity/telemetry
apps/ops             运营台：知识编辑、人工任务调度、商家白名单（V2-13 落地）
infra/               migrations、seeds、部署配置
evals/               AI 行为回归：golden set + 跑分脚本（V2-09 落地）
docs/                architecture / modules / standards / constraints / methodology / runbooks / planning
```

## 技术栈

TypeScript 单语言 monorepo（pnpm + turborepo）。Next.js 15（Web/Ops）· Expo RN（App）· Node
模块化单体（Server）· Supabase Postgres + Drizzle + pgvector · Upstash Redis/QStash · Stripe +
RevenueCat · PostHog + Sentry · 环境配置化的多 Provider LLM 路由（DashScope、DeepSeek、Moonshot、
智谱）；未验证的外部配置始终返回诚实不可用。

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
9. **接手状态永远同步** — 合并后的串行 handoff 动作更新 `docs/handoff.json` 并重新生成 Index；
   普通功能 PR 只记录 expected handoff delta，避免并行冲突。
10. **Karpathy 聚焦实现** — 显式假设，选择最小充分方案；每行改动可追溯，每步绑定验证，
   禁止预设功能、过早抽象和顺手重构。

## 路线图（触发条件驱动，非日历）

| 阶段 | 触发条件 | 内容 |
|---|---|---|
| **Phase 0**（进行中） | — | 公开 Web 的受控运行、执行事实审核、真实问题闭环、运营验证与安全/成本/质量证据 |
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
[复合工程基线](docs/governance/composite-engineering-baseline.md)：目标评审 → 系统分解/接口冻结 →
Issue → 最小充分设计 → 代码/文档/测试 → 观测和偏差校验 → 复盘归档。Issue/PR 模板是
强制证据清单，不是形式化备注。
