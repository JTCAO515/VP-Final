# VisePanda V2 最终版：绿地重构总体方案（定稿）

状态：**ACTIVE / FROZEN BASELINE**（基线已冻结，2026-07-07）
日期：2026-07-07（第三轮蒸馏收敛后合入 Codex 6 条修正，见附录 A）
性质：**定稿基线**。合并两份独立绿地方案——Codex 版（Clean-Room 重构：contract-first + GPT-5.5 智能层）与 Fable 5 版（`visepanda-v2-greenfield-architecture.md`：TS 单语言 monorepo + 知识库飞轮）——逐条裁决分歧后的最终架构。后续 V2 相关的一切规划以本文档为准，前两份已标注 superseded。
**基线修改规则**：只有两种输入有资格改动本基线——① 真实用户数据推翻假设；② 硬决策落定（见「V2 硬决策清单」issue）。改动一律走「修正案」（diff + 理由），禁止全文重写。新的 AI 观点不构成修改理由（三轮蒸馏已收敛，diff 趋零）。
前提不变：不复用、不迁移、不兼容旧代码/旧数据/旧接口/旧进度；唯一继承的是产品想法与「信任漏斗」商业方向。

---

## 0. 两版对照裁决（先给结论，再给方案）

| # | 分歧点 | Codex 版 | Fable 5 版 | 裁决 | 理由 |
|---|---|---|---|---|---|
| 1 | 客户端策略 | SwiftUI + Kotlin Compose + Next.js + Admin（4 客户端 3 语言） | Next.js + Expo RN，TS 单语言 | **采 Fable 5** | 三份原生代码 = 每个功能付三倍成本 + 永久一致性审计（V1 已付过这个学费）。Codex 自己的「小边界、契约先行、Codex 不猜字段」原则恰恰是单语言的论据：同一个 agent 能跨端修问题才是真的 Codex-Ready。原生作为「未来性能需要时的逃生门」由契约层保留可能性，不作为起点 |
| 2 | 服务端拓扑 | API Gateway + 6 个独立 service（NestJS）+ Temporal | 模块化单体（modular monolith） | **采 Fable 5，吸收 Codex 的模块命名** | 单人操作者 + AI agent 开发，6 个服务是运维负担零收益。Codex 版自己也写了「不拆太细、先能跑」——定稿把这句话执行到底：他的 service 清单降级为单体内的 module，边界规则不变（禁止跨模块碰表），未来可拆 |
| 3 | 智能层供应商 | 全文锚定 GPT-5.5 + OpenAI Responses API + Agents SDK | 供应商无关的模型路由 | **采 Fable 5 的路由抽象，吸收 Codex 的 effort 分层** | 单一供应商锁定是纯风险（价格/可用性/合规都不受控），且编排框架（Agents SDK 类）迭代太快不宜绑死。GPT-5.5 和 Claude 同为强档一等公民，廉价档用国产/小模型。Codex 版的 reasoning-effort 分层（low 分类 / medium 默认 / high 复杂行程 / xhigh 后台深度规划）是好东西，抽象成路由参数保留 |
| 4 | Agent 划分 | 9 个命名 Agent（Planner/Local Expert/Logistics/Commerce/…） | 单 Copilot + 意图路由 + 工具注册表 | **采 Fable 5 的单管道，Codex 的 9 个 Agent 降级为提示词档案（prompt profile）+ 工具** | 多 Agent = 延迟×N、成本×N、评估面×N，MVP 阶段是过度工程。「Agent」在实现上是同一管道选不同提示词档案和工具集，对外行为一致，未来要拆随时能拆 |
| 5 | 契约层 | contracts/（openapi 为源）+ 生成 ts/swift/kotlin SDK | packages/domain（zod 为源） | **zod 为源，OpenAPI 由 zod 生成** | TS 单语言栈里 zod 同时给出运行时校验 + 静态类型 + 可生成 OpenAPI（供 ops 工具/未来原生端消费）；openapi-first 在纯 TS 栈是绕路。Swift/Kotlin SDK 生成随原生端一起推迟。吸收 Codex 的 events/、errors/ 子包划分 |
| 6 | 商业账本（ledger） | click→lead→order→payment→commission→settlement 全链账本，一等原则 | 商业对象建了表但没提升为原则 | **采 Codex，全盘吸收** | 这是 Codex 版最好的贡献。任何涉钱动作必须进 ledger，升级为设计公理（见 §1 公理六） |
| 7 | AI 可回放（traces） | agent_runs/tool_calls/model_outputs 全量记录 input/output/cost/latency | 有 evals 但运行时追踪不显式 | **采 Codex** | 成本优化、质量归因、责任边界都靠它。trace 表进核心 schema |
| 8 | 获客引擎 | **缺失**（全文无获客设计） | Programmatic SEO + 知识库飞轮 + 行程分享页 + 创作者联盟 | **采 Fable 5** | Codex 版最大的洞。没有获客设计的商业化方案是空转：收入线设计得再好，没人来就没有分子 |
| 9 | 知识库 | pois/poi_tags/poi_commercial_links，无编辑工作流 | fact 可溯源可过期 + knowledge_gaps 缺口挖掘 + 编辑排期 | **采 Fable 5，吸收 poi_commercial_links** | 知识库是唯一复利资产，必须有质量工作流；「缺数据不硬凑」靠 confidence/verified_at 机制落地 |
| 10 | 路线图 | 6 个 Phase 按周排（约 24-29 周），收入验证在 Phase 3-4（第 16-20 周） | 触发条件驱动，收入验证进 Phase 0 | **采 Fable 5 的触发驱动，吸收 Codex Phase 0 的基建清单** | 按日历烧 4 个月才见第一笔收入是致命时序。Human Task 手动版（表单+Stripe 链接+创始人处理）和 outbound 埋点第一天就能收数据，不需要等基建全齐 |
| 11 | Human Task 状态机 | created→quoted→paid→assigned→in_progress→done→disputed→refunded | 简化版 | **采 Codex** | quoted（先报价后付款）和 disputed（纠纷）两个状态是真实业务必需 |
| 12 | Trip Pass 档位 | 7/14/30 天三档 | 7/14 两档 | **采 Codex** | 30 天档覆盖长停留/商务访客，边际成本为零 |
| 13 | 合规清单 | AI 风控红线 + 商业披露（partner/sponsored 标注）+ 敏感信息加密，具体 | PIPL 立场 + 越界红线评估集 | **合并** | Codex 的商业披露（FTC 式 disclosure）对美国用户是硬合规，进 UI 规范；Fable 5 的「红线进回归评估集锁死」是执行机制，两者互补 |
| 14 | Copilot 输出信封 | message/tripActions/toolCards/commercialActions/humanHelp/risk/citations/debug 统一 JSON | Patch + citations | **合并：Codex 的信封作外层，Fable 5 的 Patch 作 tripActions 的载荷** | 信封结构让「一条回复携带多种结构化卡片」有了统一契约；Patch 校验管道原样嵌入 |
| 15 | 三条链路框架 | AI Decision Loop / Travel Operation Loop / Commercial Loop | 知识库飞轮 | **合并** | 三条链路是产品视角，飞轮是数据视角，同一件事的两面，定稿两个都用 |

一句话总结裁决：**骨架用 Fable 5 版（单语言 monorepo、模块化单体、web 先行、事件溯源、知识库飞轮、触发驱动），器官移植 Codex 版最好的四样（商业账本原则、AI 全量回放、统一输出信封、Human Task 完整状态机），砍掉两版各自的过度工程（Codex 的多服务多 Agent 多语言，Fable 5 版没有的这里也不加）。**

---

## 1. 设计公理（六条）

1. **规划已商品化，执行没有。** 规划是获客钩子，执行是留存与付费，定制是利润。
2. **AI 输出不可信，必须结构化收口。** AI 只产出类型化、可校验的结构（信封+Patch），确定性代码校验后应用；AI 永不直接写库。
3. **数据资产是唯一复利项。** 每个功能必须回答：给知识库/漏斗贡献什么遥测？
4. **一份领域模型，一份真理源。** zod schema 定义一次，全端消费。
5. **商业化是架构内建。** 权益、外跳、任务、询价第一天进 schema。
6. **凡涉钱必进账本，凡 AI 调用必可回放。**（自 Codex 版吸收）click→lead→order→payment→commission→settlement 全链入 ledger；每次模型调用记录 input/tools/output/cost/latency/failure。

---

## 2. 产品定位与结构

### 2.1 定位

> **The execution copilot for foreigners in China.**
> AI 决策 + 现场工具 + 交易转化 + 人工兜底 + 商家网络。规划免费，执行可靠，出事有人管。

### 2.2 用户分层与痛点排序

（与前版一致，摘要）首次自由行游客=免费主体与 affiliate 来源；重复/商务访客=定制服务唯一可行对象；出发前研究者=SEO 获客入口。痛点排序：支付 > 网络 > 语言 > 交通执行 > 门票预约 > 突发求助 > 行程规划（重要但已商品化）。

### 2.3 产品面（五个 Surface + 旅程阶段）

```
阶段          重心       功能                                     商业动作
Dream/Plan   Web(SEO)   Copilot 对话+画布；城市/POI/问题知识页      获客；eSIM/机票外跳
Prepare      Web+App    入境清单执行；行程细化；预约提醒            eSIM/保险外跳；Trip Pass
Execute      App        Tools 八件套；离线行程；Human Help         Human Task；门票/体验外跳
Return       Web+App    回顾；复访识别；定制入口(仅重复访客)        定制询价 lead fee；分享获客
```

五个 Surface：**Copilot**（唯一 AI 交互面，对话+画布）、**Explore**（策展 POI + 场景标签：First time in China / Low Mandarin / Good in rain / Near metro / Avoid peak hours…）、**Tools**（八件套：Translate、Show to Local、Payment Helper、Transport Helper、Emergency、Entry Checklist、Network/eSIM、Human Help——全部离线可用）、**Human Help**（人工任务+定制询价）、**Me**（账号/权益/记忆可见可删/行程史/离线包）。

TripBlock 类型与块级动作采 Codex 版清单：`hotel/attraction/restaurant/transport/shopping/experience/free_time/emergency/human_task`；块动作 `Ask Copilot / Navigate / Translate address / Show to Local / Book / Add note / Request human help`。

### 2.4 三条产品链路（Codex 框架）× 一个数据飞轮（Fable 5 框架）

```
AI Decision Loop:       用户问题 → 意图路由 → 检索(知识库+记忆) → 结构化建议 → 用户确认
Travel Operation Loop:  行程 → 现场问题 → 工具解决 → 记忆/遥测沉淀 → 下一步提醒
Commercial Loop:        推荐 → 点击(outbound) → 预订/线索 → 订单 → 佣金/收入 → 运营优化

数据飞轮: 用户提问 → knowledge_gaps 挖掘 → 编辑补 fact → AI 更准 + Explore 更全 + SEO 页更多
          → 获客更便宜 → 用户更多 → 提问更多
```

### 2.5 铁律三条（与直觉相反，写死）

- **Web 先于 App**：获客在 Google 搜索里，不在 App Store 里。
- **离线优先是功能**：落地没网是常态，行程/工具卡/应急卡本地可用。
- **Chat 永不主动插商业**：commerce_intent 是显式意图类型，管道层强制；商业入口长在 Explore/行程块/Tools 后置位。所有商业推荐带 partner/sponsored 披露标注（Codex 版合规要求，采纳）。

---

## 3. 技术架构

### 3.1 平台决策（裁决 #1/#2 落地）

**TypeScript 单语言 monorepo：Next.js（Web+Ops）+ Expo/React Native（App）+ Node 模块化单体（Server）。不做原生双端，不做微服务，不上 K8s。**

### 3.2 Monorepo 结构（两版合并后的定稿）

```
visepanda/
├── packages/
│   ├── domain/            # 真理源: zod schemas + 纯函数
│   │   ├── trip/          #   TripState, TripPatch, applyPatch(), diffTrips()
│   │   ├── poi/           #   POI, PoiFacts, 场景标签推导
│   │   ├── copilot/       #   输出信封 CopilotEnvelope(见 §5.1), trace 类型
│   │   ├── task/          #   HumanTask 状态机(8态), Quote
│   │   ├── commerce/      #   Entitlement, Partner, Ledger 事件(click/lead/order/payment/commission/settlement)
│   │   ├── events/        #   统一遥测事件 schema        (Codex: events/)
│   │   └── errors/        #   类型化错误码              (Codex: errors/)
│   ├── api-client/        # 由 server router 生成(tRPC); OpenAPI 由 zod 导出供外部
│   ├── ai/                # 提示词档案(9个profile,对应Codex的9 Agent)、模型路由、输出校验
│   └── ui/                # 设计 token + 跨端基础组件
├── apps/
│   ├── web/               # Next.js: 营销+SEO页+完整产品(PWA)
│   ├── mobile/            # Expo RN: Execute 场景为中心
│   ├── server/            # 模块化单体(见 §3.3)
│   └── ops/               # 运营台: 知识编辑/任务调度/商家白名单/账本与漏斗看板
├── infra/                 # migration、seed、observability 配置
├── evals/                 # 七套评估集(见 §7) + golden set + 跑分脚本
└── docs/                  # product/ architecture/ commercial/ compliance/ adr/ runbooks/  (Codex 文档结构,采纳)
```

### 3.3 服务端：模块化单体

```
apps/server/modules/
  copilot/    # 编排管道: 意图路由→检索→生成→信封校验→Patch应用; trace 全量落库
  trip/       # 只接受 Patch; 事件溯源存储
  knowledge/  # POI/fact 读写、编辑工作流、gaps 挖掘、SEO 页数据源
  task/       # HumanTask 8态状态机 + operator 派单
  commerce/   # entitlement、outbound 网关、partner 配置、ledger、对账导入
  identity/   # 用户/记忆(可见可删)/复访分层判定
  telemetry/  # 事件摄入、漏斗物化视图
apps/server/workers/       # 队列: LLM重试、两轮生成补全、通知、对账、SEO再生成
```

规则：模块间只走显式服务接口，禁止跨模块碰表。这是 Codex 版「小边界」原则在单体里的实现——每个编码 agent 一次只改一个模块边界，未来任一模块可独立拆出。

### 3.4 基建选型

| 层 | 选型 |
|---|---|
| 托管 | Vercel（web/server/ops）+ EAS（mobile） |
| 数据库 | Postgres（Supabase：Auth+RLS+Storage）+ Drizzle ORM + pgvector（检索） |
| 队列 | Upstash Redis + QStash（BullMQ/Temporal 推迟到真需要时） |
| 支付 | Stripe（全球卡+实体服务）+ RevenueCat（IAP 抽象，仅数字权益） |
| 分析/观测 | PostHog（漏斗）+ Sentry + 自持 trace 表（AI 回放不外包） |
| 地图 | Mapbox（海外渲染）+ 高德静态 POI 坐标（GCJ-02 转换在 domain 层） |

---

## 4. 数据架构

### 4.1 行程 = 事件溯源（Fable 5 版原样）

```
trips        (id, owner, head_version, snapshot_jsonb, updated_at)
trip_events  (trip_id, version, patch_jsonb, source: user_chat|user_manual|ai_copilot|system, created_at)
```

免费获得：变更摘要、撤销、多端增量同步、离线写回、AI 行为审计、行为分析。

### 4.2 知识库（Fable 5 版 + Codex 的 commercial_links）

```
pois              (id, city, category, names, geo, source_ids)
poi_facts         (poi_id, fact_type, value_jsonb, confidence, source, verified_at, version)
poi_commercial_links (poi_id, partner, intent, deep_link)          -- Codex 版采纳
knowledge_gaps    (question_pattern, frequency, city, status)      -- 用户提问驱动编辑排期
```

fact 到期未复核自动降级不展示（缺数据不硬凑）。一份编辑投入喂三处：AI 检索 / Explore / programmatic SEO。

### 4.3 AI 回放与评估（Codex 版采纳，进核心 schema）

```
agent_runs    (id, user_id, session_id, profile, model, effort, input_digest,
               envelope_jsonb, cost_usd, latency_ms, failure_reason?, created_at)
tool_calls    (run_id, tool, args_jsonb, result_digest, latency_ms)
eval_feedback (run_id, source: user|operator|auto, verdict, note)
```

### 4.4 商业账本（Codex 原则 × Fable 5 表结构，合并定稿）

```
entitlements     (user_id, kind: free|trip_pass_7|trip_pass_14|trip_pass_30|task_credit, expires_at, source)
partners         (key, hosts[], categories[], cities[], tracking_param, status, kind: ota|creator|agency)
outbound_clicks  (click_id, user_id?, source, intent, entity_id, partner, created_at)
leads            (id, user_id, kind: quote|merchant_referral, payload_jsonb, status, partner/agency)
orders           (id, kind: human_task|trip_pass|affiliate_import, amount, currency, status)
payments         (order_id, provider: stripe|iap, provider_ref, status, refund_ref?)
commissions      (order_id?, click_id?, partner, expected, confirmed, reversed, period)
settlements      (period, counterparty, direction, amount, status, evidence_ref)
human_tasks      (id, user_id, city, kind, description, price,
                  status: created→quoted→paid→assigned→in_progress→done→disputed→refunded,
                  assignee?, transcript_jsonb, review?)
quotes           (id, user_id, trip_snapshot, requirements, status, agency_id, lead_fee)
merchants        (id, kind: helper|guide|agency|transfer, profile_jsonb, docs[], cities[], languages[],
                  status: draft→submitted→reviewing→approved→active→suspended, source: whitelist_only)
```

`human_tasks.transcript` 聚类 = 下一批知识库 fact + 下一个自动化工具的需求说明书。

### 4.5 统一遥测

```
events (id, user_id?, anon_id, surface, action, entity_type, entity_id,
        intent?, partner?, click_id?, props_jsonb, created_at)
```

所有产品/商业/AI 指标从这张表+账本物化，不散落。

---

## 5. AI 架构

### 5.1 输出信封（Codex 版）× Patch 管道（Fable 5 版）合并

所有 Copilot 回复是一个经 zod 校验的信封：

```jsonc
{
  "message": { "headline": "", "body": "", "highlights": [] },
  "tripActions": [ /* TripPatch[], 经 applyPatch 校验后才落 trip_events */ ],
  "toolCards": [ /* ShowToLocal / Transport / Payment 等结构化卡片 */ ],
  "commercialActions": [ /* 仅 commerce_intent 路由允许非空; 均带 partner 披露 + outbound click_id */ ],
  "humanHelp": null,   // 或 HumanHandoff 建议(预填任务表单)
  "risk": { "level": "low|medium|high", "reason": null },
  "citations": [ /* 指向 poi_facts id, 可溯源可纠错 */ ],
  "debug": { "profile": "trip_planner", "toolsUsed": [] }
}
```

管道：`意图路由(廉价档) → 检索(facts+记忆+行程快照) → 生成(强档,按 effort 分层) → 信封 zod 校验 → tripActions 走 Patch 业务校验 → 应用/渲染`。校验不过自动重试，降级模板兜底。**commercialActions 非 commerce_intent 时强制清空——Chat 不插广告在管道层执行，不靠提示词自觉。**

### 5.2 模型路由（供应商无关 + effort 分层）

| 任务 | 档位 | effort | 说明 |
|---|---|---|---|
| 意图分类/字段抽取 | 廉价档（DeepSeek/Qwen/Haiku 级） | low | 毫秒级，可重试 |
| 行程生成/复杂问答 | 强档（GPT-5.5 / Claude 同级互备） | medium–high | 海外可达性优先，双供应商 fallback 链 |
| 后台深度规划（两轮生成补全/行程 Review） | 强档 | xhigh | 异步队列，不占交互延迟 |
| 翻译/出示卡 | 廉价档 + 本地词库兜底 | low | 离线用预置卡 |

单用户单日 token 预算按权益分层（free 硬顶 / pass 放宽）——成本控制是权益系统的一部分。不绑任何 Agent 编排框架，编排是自有的薄管道。

### 5.3 提示词档案（起步 4 个能力模块，非多 Agent）

**Phase 0 只上 4 个能力模块**（Codex 第三轮修正，采纳）：

`router / trip_writer / knowledge_qa / commerce_human_handoff`

——同一管道按路由结果加载不同 profile+工具集，不是独立 Agent。翻译、安全红线、记忆读写作为工具/中间件挂在管道上，不单立模块。评估按模块分套（§7）。当真实复杂度出现（某模块的 eval 失败模式明显分化）再拆细到 9 个 profile（trip_planner / local_expert / logistics / translation / safety / memory 等），拆分本身不改管道结构。

### 5.4 记忆与隐私

显式结构化偏好（饮食/节奏/预算/兴趣/过敏），不存原始对话；Me 页可见可逐条删；回答用到时展示「基于你的偏好」。过敏/医疗/证件类字段加密存储（Codex 版要求，采纳）。

---

## 6. 商业化架构

### 6.1 收入线 ↔ 数据对象 ↔ 账本（一一映射）

| 收入线 | 对象 | 定价 | 账本链 | 角色 |
|---|---|---|---|---|
| Affiliate 外跳 | outbound_clicks/commissions | 佣金（归因按五折预估） | click→(order import)→commission | 意图温度计 |
| Trip Pass | entitlements/orders | $9.99/7d、$19.99/14d、$34.99/30d | order→payment | 覆盖 LLM 成本+解锁离线包/优先响应。**时序：Human Task 验证愿付费之后才上定价实验（Phase 2），不作为第一条被验证的收入线**（Codex 第三轮修正，采纳） |
| Human Task | human_tasks/orders | $14.99 起（quoted 定价） | order→payment→(settlement) | 信任建立器+数据采集器 |
| 定制询价 | quotes/leads | lead fee $50–200 或成交 5–10% | lead→settlement（B2B 月结） | 利润区，仅重复访客可见 |

### 6.2 支付路由（定死）

- Human Task / lead fee = 真实世界人工服务 → **Stripe 外部支付**（Apple 对 physical services 不强制 IAP）
- Trip Pass = 数字权益 → **IAP（RevenueCat）+ Web 端 Stripe 双轨**，Web 价更优
- 分账：lead fee 阶段 = B2B 月结发票，无平台内分账；take rate 等法务实体+跨境通道就绪才排期

### 6.3 供给侧

- 冷启动 = **创始人 concierge 前 50 单**，ops 台先只有任务列表+手动状态；50 单后才设计服务者招募与 SOP
- 商家四档白名单（人工服务者/持证导游/OTA affiliate/定制旅行社），入驻状态机 `draft→submitted→reviewing→approved→active→suspended`（Codex 版），全部内部录入无公开注册
- Operator Console（Codex 版清单采纳）：任务队列、用户/行程上下文、建议回复、通话记录、完成凭证、退款/纠纷

### 6.4 获客引擎（Fable 5 版原样，Codex 版缺失项）

1. Programmatic SEO：`/[city]/[poi]`、`/guides/[question]` 从知识库生成+编辑润色，ISR；知识库扩一批，SEO 面自动扩大
2. 行程分享页：公开只读（去隐私）即着陆页，用户即渠道
3. 创作者双向联盟：China travel YouTuber 专属深链归因（partners.kind=creator）
4. App Store 只承接「已在华急需工具」搜索流量

### 6.5 信任漏斗物化

```
匿名(SEO) → 注册(存行程) → 商业点击 → 首次付费(Task/Pass) → 复访识别 → 定制询价
```

每层转化率 = 物化视图，第一天建。复访判定：账号年龄 > 90 天 且 ≥2 个不同城市/日期行程（identity 模块）。

---

## 7. 评估与合规

### 7.1 七套评估集（Codex 清单 × Fable 5 执行机制）

`trip_generation / trip_patch / poi_recommendation / translation / safety / commerce_recommendation / human_handoff`
——每套含 golden set；指标：schema 遵守率、工具选择正确率、编造检测（商家/价格/政策）、人工转接触发正确率、商业披露完整率、高风险拒答率。**凡 PR 碰提示词/模型/路由必跑对应套件，红线用例锁死不许回归。**

### 7.2 AI 风控红线（Codex 版，采纳并进评估集）

不承诺签证通过、不做医疗诊断、不替代法律意见、不编造营业时间/票价/政策、高风险建议附免责声明、商业推荐必须标注 partner/sponsored。

### 7.3 数据合规

用户主体为外国人、服务器在境外、境内仅静态 POI 数据（PIPL 立场）；记忆可见可删；敏感字段（过敏/医疗/证件）加密；AI 日志脱敏；商家资质文件独立权限；支付信息不自存（Stripe/RevenueCat 托管）。

---

## 8. 路线图（触发条件驱动；吸收 Codex Phase 0 基建清单）

### Phase 0 — Clean Foundation + Web MVP（唯一按日历的阶段：8 周内公开）

基建（Codex 清单）：monorepo + packages/domain v1 + auth + Postgres schema v1 + copilot 管道骨架 + trace 落库 + CI（typecheck/单测/契约测试/evals 门槛）+ Issue/PR 模板。
产品（Fable 5 刀刃集）：Copilot 对话+画布（信封+Patch 管道完整，两轮生成）；北京+上海知识库（人工核实 fact）；支付/eSIM/网络三篇深度指南（=SEO 页）；**Human Task 表单+Stripe 链接（创始人手动处理）**；outbound 网关+统一遥测；**programmatic SEO 首批 ~200 页（Phase 0 最高优先级交付之一——低 CAC 的根，越早上线越早积累索引）**。
**Ops 最小台随 Phase 0 一起上**（Codex 第三轮修正，采纳：知识库和人工兜底靠运营台活着，Ops 早于 App）：三个列表页——人工任务列表（手动改状态）、POI fact 编辑、knowledge gaps 列表。不多做一个像素。
商业看板：**第一版 = events 表 + 物化视图 + SQL 查询，不做 BI/dashboard UI**（Codex 第三轮修正，采纳）。
明确不做：App、商家后台、佣金对账自动化、多语言 UI、dashboard UI。

### Phase 1 — 触发：周活 ≥ 200 真实外国用户 或 Human Task ≥ 20 单

Expo App（Execute 场景：离线行程+Tools 八件套+Human Help）；知识库扩 6 城（gaps 驱动排期）；拿点击数据谈 Klook/Trip.com 正式 affiliate；ops 台成型（任务调度+知识编辑工作流+账本看板）。

### Phase 2 — 触发：单城定制询价 ≥ 5 次/月 且 复访占比可测

Quote 市场（白名单旅行社 lead fee）；服务者网络（从 concierge SOP 招募）；Trip Pass 定价实验；佣金对账自动化（有真实流水才做）。

### Phase 3 — 触发：月撮合订单 ≥ 100 且 法务实体就绪

take rate + 平台内分账；商家自助程度提升（仍白名单）。

### 首批 20 个 Issue（对齐定稿架构，替换 Codex 版清单中已被裁决掉的项）

1. Bootstrap monorepo（pnpm+turborepo+CI）
2. packages/domain v1：TripState/TripPatch/applyPatch+单测
3. domain：CopilotEnvelope + errors/events 子包
4. Supabase 项目+Auth+Postgres schema v1（trips/trip_events/users）
5. server 骨架：模块边界+tRPC router+api-client 生成
6. copilot 模块：管道骨架（路由→检索stub→生成→校验→应用）
7. 模型路由层：双供应商 fallback+effort 参数+成本记账
8. agent_runs/tool_calls trace 落库
9. evals 框架+trip_generation 首套 golden set
10. Web shell：Copilot 对话+画布（消费信封渲染）
11. 两轮生成 worker（骨架→补全）
12. knowledge 模块：pois/poi_facts schema+读 API
13. 北京+上海首批 fact 编辑录入（ops 最小编辑界面）
14. Explore 页（场景标签筛选，消费 poi_facts）
15. 三篇深度指南页（支付/eSIM/网络，SEO 结构）
16. programmatic SEO 模板（/[city]/[poi] ISR）
17. outbound 网关+partners 配置+outbound_clicks
18. 统一遥测 events 摄入+PostHog 漏斗
19. Human Task 表单+Stripe payment link+ops 任务列表
20. Issue/PR 模板+文档骨架（docs/adr 起步）

---

## 9. 工程流程（为多 Agent 开发设计）

1. **Schema 先行**：功能先改 domain（zod+纯函数+单测）单独 PR，前后端消费是后续 PR，契约漂移死在编译期
2. **一个 PR 一个边界**（Codex 原则）：一个模块 / 一个 contract change / 一个 UI flow
3. **每 PR 硬门槛**：typecheck+单测+契约测试；碰提示词/模型必带 evals；碰商业逻辑必带 ledger 测试（Codex 原则，采纳）
4. **Trunk-based + feature flag**：商业入口全 flag，触发条件满足才翻开
5. **Issue/PR 模板**（Codex 版字段采纳）：Issue 含 Context/Scope/Do-not-touch/Contracts/Acceptance/Commercial impact/Risk；PR 含 Contracts changed/Evals/Commercial tracking/Rollback plan
6. **每周知识库质量审查**：抽样 fact 复核+gaps 清理，运营节拍入 ops 工作流

---

## 10. 反目标（合并两版，立约）

- 不做原生三端；不做微服务/K8s；不绑单一 LLM 供应商；不绑 Agent 编排框架
- 不做 OTA 闭环/自营库存/平台内全额托管支付；不做开放商家注册（白名单到月订单 100+）
- 不做代付（维持否决）；不做机票比价；不碰签证代办资质业务
- 不做社交社区、多国家平台、大而全 CMS（Codex 版不做清单，采纳）
- Chat 不做主动商业推荐（管道强制）；无 ledger 不上任何收钱功能
- 触发条件未满足不建设：商家后台/对账自动化/dashboard UI/多语言
- 凡不能回答「给知识库/漏斗贡献什么」的 AI 功能不排期

---

## 11. 一页总结

**裁决**：骨架取 Fable 5 版（TS 单语言 monorepo、模块化单体、Web 先行、事件溯源、知识库飞轮、触发驱动路线），移植 Codex 版四个最佳器官（凡钱必账本、AI 全量回放、统一输出信封、完整任务状态机），双方的过度工程全部砍掉。
**产品**：执行副驾——规划免费获客，工具留存，人工兜底付费，定制询价盈利；三条链路（决策/运营/商业）+ 一个数据飞轮。
**技术**：Next.js+Expo+Node 单体，domain 包唯一真理源，AI 只出经校验的信封+Patch，双供应商模型路由。
**商业**：四条收入线全部账本化；信任漏斗逐层物化；Stripe 为主 IAP 为辅；创始人 concierge 冷启动。
**节奏**：8 周 Web MVP（含第一笔 Human Task 收入的通路），此后一切按触发条件解锁，不按日历烧钱。

---

## 附录 A：第三轮蒸馏收敛记录（2026-07-07，基线冻结依据）

Codex 读完本定稿后的回应为「基本认同主干」+ 6 条修正，全部采纳并已合入正文：

| # | Codex 修正 | 处理 |
|---|---|---|
| 1 | Agent 不要一开始拆 9 个，先 4 个能力模块 | §5.3 改为 router/trip_writer/knowledge_qa/commerce_human_handoff 起步，复杂度出现再拆 |
| 2 | Trip Pass 不要过早作为核心收入，先验证 Human Task | §6.1 Trip Pass 行加时序说明：定价实验在 Human Task 验证后（Phase 2） |
| 3 | Ops 台要比 App 更早做 | §8 Phase 0 显式加入 Ops 最小台（任务列表/fact 编辑/gaps 列表三个列表页） |
| 4 | 商业 dashboard 第一版只做 event 表+物化视图 | §8 Phase 0 明确「不做 BI/dashboard UI」，加入不做清单 |
| 5 | Programmatic SEO 要更早 | §8 Phase 0 标注 SEO 为最高优先级交付之一 |
| 6 | Mobile 触发条件驱动 | 定稿原有（Phase 1 触发条件），无需改动 |

**收敛判定**：第一轮=两份独立全文方案；第二轮=15 项分歧裁决；第三轮=6 条小修正且全部相容、零结构性分歧。diff 趋零，蒸馏关闭。自本记录起基线冻结，后续修改只接受「真实用户数据」或「硬决策落定」两种输入，走修正案格式。
