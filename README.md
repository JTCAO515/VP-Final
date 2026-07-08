# VisePanda V2 (VP-Final)

> **The execution copilot for foreigners in China.**
> 规划免费，执行可靠，出事有人管。

面向来华外国旅行者的执行副驾：AI 行程规划是免费获客入口，产品的真正核心是「中国现场执行」——支付、网络、语言、交通、预约、突发求助——配付费人工兜底（Human Task）与定制行程询价（lead fee）变现。不是 AI 攻略生成器，不是 OTA，不是工具箱合集。

**本仓库是 VisePanda V2 的唯一开发仓库。** V1（`VP-Codex-Final`）自 2026-07-07 起只收尾不开新功能，V2 Web MVP 公开后冻结（见 [ADR-0001](docs/adr/ADR-0001-repo-and-v1-disposition.md)）。V2 为绿地重构，不继承 V1 任何代码、数据与文档。

---

## 从这里开始（按序读）

| # | 文档 | 作用 |
|---|---|---|
| 1 | [`docs/planning/visepanda-v2-final-architecture.md`](docs/planning/visepanda-v2-final-architecture.md) | **冻结基线（FROZEN BASELINE）**——本仓库唯一规划输入。产品定位、技术架构、数据模型、AI 管道、商业闭环、路线图全在里面。修改规则见其附录 A：只接受「真实用户数据」或「硬决策落定」两种输入，走 diff 修正案，禁止全文重写 |
| 2 | [`docs/adr/`](docs/adr/) | 已定决策记录。不要在 PR 里重新争论已裁决事项 |
| 3 | [Issues](../../issues) | 首批任务 V2-02 ~ V2-20，对应基线 §8 二十项清单，**按序领取** |

## 当前状态

- ✅ V2-01 Bootstrap 完成：monorepo 骨架、CI、模板、ADR、基线入库（`fc7c4e8`）
- ⬜ 下一个可开工：**V2-02 `packages/domain` v1**（TripState/TripPatch/applyPatch）——无外部依赖
- ⏳ 待操作者拍板（不阻塞 V2-02~V2-18）：D3 Human Task 支付路由、D4 公司实体/Stripe 收款主体（V2-19 上线前必须落定）、D5 品牌视觉时机 → 决策入口在 [VP-Codex-Final#169](https://github.com/JTCAO515/VP-Codex-Final/issues/169)

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
docs/                planning(基线) / adr(决策) / runbooks / commercial / compliance
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

## 路线图（触发条件驱动，非日历）

| 阶段 | 触发条件 | 内容 |
|---|---|---|
| **Phase 0**（进行中，唯一按日历：8 周） | — | Web MVP：Copilot+画布、京沪知识库、三篇 SEO 深度指南、~200 张 programmatic SEO 页、Human Task 表单（创始人 concierge）、outbound 埋点、Ops 三列表页 |
| Phase 1 | 周活 ≥200 真实外国用户 或 Human Task ≥20 单 | Expo App（离线行程+Tools 八件套）、知识库扩 6 城、正式 affiliate 谈判 |
| Phase 2 | 单城定制询价 ≥5 次/月 | Quote 市场（lead fee）、服务者网络、Trip Pass 定价实验 |
| Phase 3 | 月撮合订单 ≥100 且法务实体就绪 | take rate + 平台内分账 |

## Quickstart

```bash
# Node >= 20, pnpm 9 (npm i -g pnpm@9)
pnpm install
pnpm build && pnpm test && pnpm typecheck && pnpm lint   # 全绿才算环境就绪
```

## 协作方式

本项目由 AI coding agent（Codex 等）+ 架构师（Claude）+ 操作者协作开发。领活流程：按序取 issue → 按 issue 模板补全字段 → 分支 `agent/<name>-<slug>` → PR 过全部硬门槛 → 架构师审查合并。Issue/PR 模板已内置必填字段（Domain schema impact / Commercial tracking / Evals / Rollback plan）。
