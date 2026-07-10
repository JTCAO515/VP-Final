# VisePanda V2 项目复盘、架构修正与执行路线图

日期：2026-07-10
性质：现状审计与执行修正案，不替代 `visepanda-v2-final-architecture.md` 冻结基线
审计对象：`JTCAO515/VP-Final` 当前 `main`、GitHub Issues/PR、Vercel/Supabase/AI/商业化设计与本地可运行页面

审计结论：**Fable-5 主架构不需要推翻。项目已经达到“可信演示骨架”阶段，但尚未达到“可公开收费的生产 MVP”阶段。下一步不应继续扩功能面，而应先完成身份安全、真实 AI、数据持久化、商业账本和运营闭环。**

---

# 第一章：项目现状复盘

## 1.1 原始产品规划概要

冻结基线的核心判断仍然成立：

> VisePanda 不是通用行程生成器，而是外国人在中国旅行时的执行副驾。规划用于获客，执行用于留存，人工兜底用于付费，定制询价用于利润。

原始方案由六条公理约束：

1. 规划已商品化，执行仍有价值。
2. AI 只产生类型化信封和 `TripPatch`，不能直接写用户状态。
3. POI 实用事实、失败案例和人工任务记录是长期复利资产。
4. `packages/domain` 是全端唯一领域真理源。
5. 权益、外跳、人工任务、询价从第一天就是领域对象。
6. 凡涉钱必须进账本，凡 AI 调用必须可回放。

技术基线为 Fable-5 架构：TypeScript 单语言 monorepo、Next.js Web/Ops、Expo React Native、Node 模块化单体、Supabase Postgres、Drizzle、Upstash/QStash、Stripe/RevenueCat、PostHog/Sentry，以及供应商无关的模型路由层。

产品路线原定为：

- Phase 0：Web Copilot、Trip Canvas、京沪知识库、三篇指南、programmatic SEO、Human Task、outbound、Ops、遥测。
- Phase 1：达到真实用户触发条件后建设 Expo App、离线工具和六城知识库。
- Phase 2：验证复访与询价需求后建设定制询价、服务者网络和 Trip Pass。
- Phase 3：月撮合量与法务条件满足后再做平台分账和更开放的供给侧。

## 1.2 当前已完成开发清单

### 工程基础

| 资产                      | 当前状态                                                                              | 审计判断                                 |
| ------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------- |
| pnpm + Turborepo monorepo | 已落地                                                                                | 可继续使用                               |
| `packages/domain`         | Trip、CopilotEnvelope、knowledge、task、commerce、events、errors 已有 schema 和纯函数 | 当前最成熟资产                           |
| `packages/api-client`     | 已建立 tRPC 类型契约                                                                  | 可用，但尚未形成完整外部 API 边界        |
| `packages/ai`             | 有 provider 接口、fallback、effort、成本计算和静态测试 provider                       | 仅抽象完成，未接真实模型                 |
| `apps/server`             | copilot/trip/knowledge/task/commerce/identity/telemetry 模块目录和 tRPC router 已建立 | 模块边界正确，能力完成度不均             |
| CI                        | typecheck、lint、build、test、evals 已接入                                            | 流程可用，但 Node 版本和 eval 深度需修正 |

### 数据与后端

已存在 Supabase migrations：

- `users`、`trips`、`trip_events`
- `agent_runs`、`tool_calls`
- `pois`、`poi_facts`、`knowledge_gaps`、`poi_commercial_links`
- `partners`、`outbound_clicks`
- `events`、`trust_funnel_daily`
- `human_tasks`
- anonymous trip、share token、fact/gap workflow 扩展

Trip DB service 已支持：

- snapshot + append-only patch event
- anonymous owner
- 登录后 claim
- read-only share token
- event 读取

Knowledge DB service 已支持：

- POI/fact 查询
- fact 新增、更新、续期、废弃
- expired fact 队列
- knowledge gap 记录、聚合和状态更新

### 用户端 Web

当前已存在并能构建的页面：

- Copilot 工作台：对话、Trip Canvas、两阶段状态、分享入口、ToolCard、citation、commercial action、Human Help 预填
- Explore：场景标签筛选和 4 个 seed POI
- 三篇指南：Payment、eSIM、Network
- 4 个 POI SEO 页面
- Human Help 表单
- Trip 公开只读分享页
- sitemap

Copilot 视觉已采用红金设计方向，桌面端完成了“Trip Canvas + Copilot rail”工作台布局；设计语言“宣纸白、墨色、中国红、少量烫金”是正确方向。

### Ops

当前已有三个最小页面：

- Fact Editor
- Fact review / expired workflow
- Knowledge Gaps
- Human Task 列表和基础编辑 UI

### GitHub 进度

截至审计日：

- V2-02 至 V2-35 已关闭。
- #39/#40 红金 Copilot 工作台已关闭。
- 当前开放项主要为 V2-36 至 V2-80 的后续任务，共约 45 个 Issue。
- 本地 `main` 位于 PR #105 合并后的提交 `0486707`。

### 真实验证结果

本次复盘重新执行：

```text
pnpm typecheck  PASS
pnpm lint       PASS
pnpm build      PASS
pnpm test       PASS
pnpm evals      PASS（仅 5 个 trip_generation fixture）
```

构建产物显示：Web 19 个静态/动态 route，Ops 11 个 route。当前代码质量门槛可运行，但测试覆盖分布不均：domain/server 较好，Web 只有 1 个 ledger 测试，Ops 只有 2 个 store 测试，Mobile 无测试。

## 1.3 未实现功能清单

### P0 级未完成

1. **真实 AI 未接通。** `packages/ai` 没有真实 provider 实现，Copilot 管道未调用模型路由；意图、检索、生成和第二轮补全均为确定性 stub。
2. **真实检索未接通。** Copilot 默认永远检索 `stub:china-execution-basics`，并返回 stub citation；已建设的 `poi_facts` 尚未进入回答上下文。
3. **身份系统未落地。** 没有 Supabase Auth Web 会话，客户端把 `userId/email` 放在 localStorage 并直接传给服务端。
4. **行程所有权存在严重安全缺口。** API 信任客户端传入的 `userId`、`anonId` 和 `currentTrip`；现有 trip update 没有强制验证 owner，存在越权读取、claim、share 或覆盖的风险。
5. **Ops 没有认证与 RBAC。** Facts、Gaps、Tasks 写接口均可在没有运营身份校验的情况下访问。
6. **Human Task 仍是内存数据。** Web、Ops 和 server 各自存在独立内存 store；刷新、冷启动或 serverless 实例切换会丢失或分叉。
7. **Outbound 仍是内存账本。** `outbound_clicks` 表存在，但 `/outbound` 只写进进程内数组。
8. **Telemetry 仍是内存实现。** `events` 表存在，但 server 未写数据库；PostHog 也没有端到端事件接线。
9. **AI trace 没有运行时落库。** `agent_runs/tool_calls` 只有 schema；Copilot 返回的是响应内 trace 摘要，不是数据库回放记录。
10. **Stripe 未真实接入。** 当前由 Ops 人工粘贴 payment link；无 Checkout Session 创建、webhook、幂等和 payment ledger。
11. **生产配置证据不足。** 本地 `.env.local` 仅有 Vercel OIDC token，没有 `DATABASE_URL` 或 AI provider 配置；当前本地运行必然进入内存/stub 路径。
12. **安全和上线基建缺失。** 无 rate limit、token budget、Sentry、健康检查、完整法律页和生产 runbook。

### P1/P2 级未完成

- 20 个以上经过人工核实的高价值 SEO 页面，更遑论 200 页。
- SEO editorial override、canonical/noindex/robots 和索引质量门槛。
- 城市/POI 图片、地图、真实执行 CTA 和统一全站导航。
- 用户账号页、记忆可见可删、权益系统。
- 六城知识库、批量导入、来源证据结构。
- Expo App、离线行程、Tools、Show to Local、移动端 Human Help。
- Trip Pass、RevenueCat、定制询价、服务者网络、佣金对账。

## 1.4 现有架构与原始设计出现的偏差汇总

| 偏差           | 原始设计                    | 当前实现                                                     | 影响                                   |
| -------------- | --------------------------- | ------------------------------------------------------------ | -------------------------------------- |
| Issue 完成口径 | 可运行生产闭环              | 多数以 schema、stub 或 memory 实现即关闭                     | 管理层高估上线进度                     |
| AI 管道        | 双 provider 真实调用 + 回放 | static provider + deterministic envelope                     | 产品核心仍是 demo                      |
| 知识飞轮       | fact 进入 RAG，问题产生 gap | Copilot 使用固定 stub citation                               | 飞轮没有真正启动                       |
| Server 拓扑    | 可部署模块化单体            | `apps/server` 无 HTTP runtime，Web 直接 import server caller | Phase 0 可接受，但移动端前必须明确边界 |
| Auth           | Supabase Auth + RLS         | localStorage 模拟用户身份                                    | 生产阻塞、存在 BOLA 风险               |
| 商业账本       | 所有钱和外跳入 DB ledger    | outbound/task/telemetry 多为内存                             | 无法对账、无法证明转化                 |
| Ops            | 早期最小运营台且受保护      | 页面已存在，但公开无 RBAC                                    | 可用性有，安全性没有                   |
| SEO            | 知识库驱动约 200 页         | 4 个 static seed POI 页面                                    | 获客引擎尚未形成                       |
| Mobile         | 触发后 Expo                 | 仍为 placeholder                                             | 与路线一致，不是落后                   |
| 视觉系统       | 红金成为品牌系统            | Copilot 已采用，Explore/Human Help/Guides 不统一             | 品牌只落在一个页面                     |
| 文档状态       | README 反映当前进度         | README 仍写“下一个 V2-02”                                    | 协作和排期易误判                       |

基于代码事实的阶段判断：

- 工程基础完成度：约 70%。
- 可演示 Web 产品完成度：约 60%。
- 生产安全与持久化完成度：约 30%。
- 商业收款闭环完成度：约 15%。
- Mobile/Phase 1 完成度：约 5%，但当前不应提前建设。

这些百分比是审计估算，不是团队绩效指标。真正的判断是：**当前可内部演示，不宜公开承诺“真实 AI、真实保存、真实人工服务或真实 affiliate”。**

---

# 第二章：架构评审与优化建议

## 2.1 当前架构优缺点分析

### 优点

1. **TS 单语言 monorepo 决策正确。** 对单人操作者 + 多 Coding Agent 项目，领域 schema、Web、Server、未来 Expo 同语言显著降低契约漂移。
2. **模块化单体正确。** 当前规模不需要微服务、K8s 或 Temporal；服务边界已经足够清楚。
3. **Patch 管道正确。** `applyPatch()`、Trip snapshot 和 event log 是最有价值的技术资产，既可审计又便于同步和回滚。
4. **商业对象提前建模正确。** Partner、OutboundClick、HumanTask、Telemetry 已进入 domain/database，后续不用推翻数据模型。
5. **知识库 fact 生命周期设计正确。** `source/confidence/verifiedAt/expiresAt/status/version` 符合“宁缺毋滥”的产品原则。
6. **两阶段生成方向正确。** skeleton 先渲染、details 静默补全适合行程这种高延迟结构化生成。
7. **设计方向正确。** 红金不是大面积节庆装饰，而是动作、服务等级和可信背书，适合国际游客。

### 缺点与隐患

#### 致命级：身份与所有权

- `/api/copilot`、Trip lookup、share、claim 接受客户端提供的 `userId`。
- `currentTrip` 由客户端提交并被服务端信任。
- DB trip `save()` 更新已有行程前没有校验请求 owner 与数据库 owner 一致。
- existing trip 可被写入另一个 `anonId`。

这不是普通“Auth 未完成”，而是明确的对象级授权漏洞。上线前必须删除“客户端自报身份”模式：用户身份只从经过验证的 Supabase session 获取，匿名身份只从服务端签发的 HttpOnly cookie 获取。

#### 高风险：数据库暴露和 Ops 权限

- `partners`、`outbound_clicks`、`events`、`human_tasks` migrations 未显式启用 RLS，也未定义最小 grant/policy。
- `trust_funnel_daily` 位于 `public`，没有明确 revoke/private schema 策略。
- Ops route 没有认证和角色校验。

Supabase 当前文档强调 exposed schema 中的表应启用 RLS，并且 grants 与 RLS 是两层独立控制；2026 年新项目还要求 Data API 显式 grant。[Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) · [Data API 安全](https://supabase.com/docs/guides/api/securing-your-api) · [2026 Data API 变更](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically)

#### 高风险：伪生产路径

- `DATABASE_URL` 缺失时自动回退内存，部署错误不会明显失败。
- Copilot API 名义上是“真实 server API”，实质仍返回固定 envelope。
- UI 固定显示 `Online`，默认展示未标注的 demo trip 和“票快卖完”等虚构紧迫性。
- pending partner 在 `buildOutboundUrl()` 中仍可跳转。

建议把运行模式显式化为 `demo | staging | production`：production 缺少数据库、AI 或 partner 配置时必须 health degraded/请求失败，不能静默降级成看似真实的数据。

#### 中风险：事件溯源并发

Trip service 先在事务外读取 `head_version`，再写 snapshot/event。并发请求可能覆盖 snapshot 或争用同一 version。应加入：

- 请求携带 `expectedVersion`。
- `UPDATE ... WHERE head_version = expectedVersion`。
- 失败返回 `409 TRIP_VERSION_CONFLICT`。
- completion/job 使用 idempotency key。

#### 中风险：模块边界只存在于目录，不存在于所有写路径

Web Human Help、Web Outbound、Ops Task 各自实现 store，没有统一走 server task/commerce service。建议保留模块化单体，但所有写入都统一经过 server module service；Next.js route 只做 session、校验和响应转换。

#### 中风险：Node 运行时已过期

仓库和 CI 仍使用 Node 20。Supabase 已于 2026-06-30 结束其 JS 生态对 Node 20 的支持，明确要求 Node 22+。[Supabase Node 20 deprecation](https://supabase.com/changelog/45715-deprecation-notice-dropping-support-for-node-js-20)

## 2.2 数据库、API、权限、部署方案优化意见

### 数据库

1. 新增安全修复 migration：为 operational tables 启用 RLS；按 public read、authenticated own、ops-only、server-only 分类配置 grants/policies。
2. 把 `trust_funnel_daily` 放入不可暴露的 `internal` schema，或明确 revoke `anon/authenticated`。
3. 为 `knowledge_gaps` 增加 `(question_hash, city)` 唯一键，用原子 UPSERT 替代全表扫描再更新。
4. 对写入 knowledge gap、trace、telemetry 的文本先做 PII redaction；用户原始 prompt 不默认进入分析表。
5. 给 `trip_events` 增加幂等键或 request id；给 trip save 加 optimistic concurrency。
6. 为 payment 增加独立 ledger，不把 `human_tasks.status = paid` 当作唯一付款证据。
7. POI fact 后续增加 `sourceUrl/sourceKind/evidence/verifiedBy`，让 citation 可真正审计。

### API

1. 从所有公开 request schema 删除 `userId/email`；身份由 server context 注入。
2. 删除 `currentTrip` 作为权威输入；服务端按 `tripId + session owner` 读取 snapshot。客户端可传 `expectedVersion`，不能传可覆盖的权威状态。
3. 匿名会话使用服务端签发、HttpOnly、Secure、SameSite=Lax cookie；不把 localStorage UUID 当授权凭证。
4. 给 create/claim/share/checkout/webhook 增加 idempotency。
5. 统一类型化错误：401、403、404、409、422、429、502；前端按错误类型给出诚实状态。
6. Phase 0 暂不强拆 standalone server。Web/Ops 可以继续把 `apps/server` 当共享领域服务包；Phase 1 Mobile 开工前再提供唯一外部 tRPC/HTTP endpoint。

### 权限

建议角色最小化：

| 角色                   | 权限                                                 |
| ---------------------- | ---------------------------------------------------- |
| anonymous traveler     | 仅本人匿名 trip、公开 POI/guide、创建受限 Human Task |
| authenticated traveler | 仅本人 trips/tasks/profile/entitlements              |
| operator               | task 处理、有限联系人读取、不可改系统配置            |
| editor                 | POI/fact/gap 编辑，不可看支付和联系方式              |
| admin                  | partner、price、role 和审计配置                      |
| service runtime        | 通过受控 server connection 执行后台任务              |

不要使用用户可编辑的 `user_metadata` 做授权；运营角色应放在不可由用户修改的 app metadata 或独立 membership 表，并在服务端和 RLS 双重校验。

### 部署

1. Node runtime、CI 和 `engines` 统一升级到 Node 22。
2. Vercel 至少拆为两个 project：公开 Web 与受保护 Ops；不要把 Ops 路由挂在公开 Web 导航。
3. Phase 0 保持 API 随 Web Functions 部署，减少运维面；Phase 1 再决定是否把 server 暴露为单独 service。
4. 建立启动/健康检查：DB、AI primary/fallback、PostHog、Sentry、Stripe、queue 分别显示 configured/degraded。
5. production 禁止 memory adapter；memory adapter 只允许 test/demo，且页面必须显示 Demo mode。
6. Vercel 上为 completion 配置可承受真实模型延迟的 function timeout，或使用 QStash 将第二轮补全改成耐久 job。

## 2.3 是否需要局部重构，给出重构范围与方案

结论：**需要局部重构，不需要重新建仓、不需要微服务化。**

建议分四个边界处理：

### 重构 A：Identity Boundary

- Supabase Auth SSR session。
- signed anonymous session。
- request context 注入 owner。
- Trip/HumanTask/Share 全部按 owner 校验。
- Ops RBAC。

### 重构 B：Persistence Boundary

- production adapter 必须是 DB。
- Web/Ops route 统一调用 server service。
- 删除三套 task/outbound/telemetry 内存真理源。
- DB migration replay、RLS、advisor 进入 CI/runbook。

### 重构 C：AI Runtime Boundary

- provider implementation → model router → prompt profile → structured envelope parse。
- KnowledgeService 真实检索。
- trace/cost 持久化。
- 两阶段生成 idempotent/durable。
- production 失败诚实报错，不返回伪答案。

### 重构 D：Trust UI Boundary

- 未登录首页不展示未标注的假行程和假票务稀缺。
- `Online` 改为真实连接状态。
- 删除或接通 Add Block、+Day、Route、quick replies 等无行为按钮。
- Citation 显示来源与核实时间。
- commercial CTA 只允许 active/approved partner。

以上重构不改变 `packages/domain` 主模型，不改变 Patch 公理，不改变模块化单体方向，因此与 Fable-5 完全兼容。

---

# 第三章：结构化 Issues 任务清单

## 3.0 估算口径

- XS：半个 agent-day。
- S：1 agent-day。
- M：2-3 agent-days。
- L：4-6 agent-days。
- XL：必须继续拆分，不允许单 PR 交付。

以下 Issue 可直接复制到 GitHub。已有 Issue 在标题后标注映射；建议修改原 Issue 验收口径，而不是重复创建。

## 3.1 P0：公开 MVP 阻塞项

### P0-01 Runtime 基线升级到 Node 22

- 任务描述：更新 root engine、GitHub Actions、Vercel runtime 和本地文档；验证 Supabase/Next/Drizzle 兼容。
- 前置依赖：无。
- 验收标准：Node 22 下 install/typecheck/lint/build/test/evals 全绿；CI 不再使用 Node 20。
- 工作范围：S，root config + CI + docs。

### P0-02 Supabase migrations 真实回放与安全修复

- 任务描述：在真实 dev project 或本地 Postgres 全量回放 migrations；补 partners/outbound/events/human_tasks RLS/grants；保护 trust funnel view；运行 advisors。
- 前置依赖：P0-01。
- 验收标准：空库可一次完成迁移；anon/authenticated/ops 权限测试通过；无暴露的 operational table；migration list 与 repo 一致。
- 工作范围：L，`infra/supabase` + DB contract tests。

### P0-03 Supabase Auth SSR + 服务端匿名会话

- 任务描述：接 Supabase Auth Web 会话；匿名用户由服务端生成 signed HttpOnly cookie；建立 server request identity context。
- 前置依赖：P0-02。
- 验收标准：未登录可创建 trip；登录后可 claim；伪造 body/query 的 userId 无效；cookie 安全属性正确。
- 工作范围：L，Web auth/session + server context。

### P0-04 Trip 所有权、并发与越权回归测试

- 任务描述：禁止信任客户端 `currentTrip/userId`；DB save 强制 owner match；加入 expectedVersion 和 409 冲突；覆盖 read/claim/share/update BOLA 测试。
- 前置依赖：P0-03。
- 验收标准：用户 A 无法读取、覆盖、claim、share 用户 B 的 trip；并发 patch 不静默覆盖；所有写入仍经 `applyPatch`。
- 工作范围：L，trip service/router/API/tests。

### P0-05 Ops 登录与 RBAC

- 任务描述：Ops 应用只允许 operator/editor/admin；按页面和 API 区分 task、knowledge、partner 权限。
- 前置依赖：P0-03。
- 验收标准：未登录 401/跳登录；普通 traveler 403；editor 不可看联系人；operator 不可改 partner。
- 工作范围：M，Ops middleware/session/API guards。

### P0-06 Production adapter 收敛

- 任务描述：Web Human Help、Outbound、Ops Tasks、Telemetry 全部调用 `apps/server` service；production 缺 DB 时 fail closed，memory adapter 仅 test/demo。
- 前置依赖：P0-02、P0-05。
- 验收标准：代码中不存在第二套生产 store；serverless 冷启动后数据仍在；缺 `DATABASE_URL` 的 production health 为 degraded。
- 工作范围：L，server services + Web/Ops routes。

### P0-07 真实 LLM provider 与结构化输出（包含现有 #74 的模型评估主线）

- 任务描述：实现至少 primary + fallback 两个 provider；把 Copilot pipeline 接到 model router；使用 `CopilotEnvelopeSchema` 严格解析、修复、有限重试。
- 前置依赖：P0-01、P0-06。
- 验收标准：真实请求产生非固定 itinerary；primary 失败后 fallback；全部失败返回诚实 502；无 key 不伪造答案；成本/latency 可记录。
- 工作范围：L，`packages/ai` + copilot service + evals。

### P0-08 真实 Knowledge Retrieval + 可审计 Citations

- 任务描述：按 city/category/intent 检索 current active facts；把 fact id/source/verifiedAt 放入模型上下文和回答 citation；低证据时回答不知道。
- 前置依赖：P0-06、P0-07、现有 #57。
- 验收标准：回答引用真实 fact；expired/deprecated fact 不进入上下文；无结果不产生伪 citation；prompt 先做 PII redaction 再写 gap。
- 工作范围：L，knowledge/copilot/evals。

### P0-09 Agent trace、工具调用和成本真实落库（映射 #73）

- 任务描述：每次模型尝试和工具调用写 `agent_runs/tool_calls`；支持 anon；保存 provider/model/token/cost/latency/failure，不存未脱敏敏感原文。
- 前置依赖：P0-03、P0-07。
- 验收标准：匿名和登录调用均可回放；fallback 的每次 attempt 可见；trace 失败不改变用户数据。
- 工作范围：M。

### P0-10 两阶段生成耐久化与幂等

- 任务描述：skeleton 首包返回后，将 details completion 变成带 job id 的耐久任务；重复请求只补一次；保留“无新聊天气泡”规则。
- 前置依赖：P0-04、P0-07、P0-09。
- 验收标准：函数超时/重试后能继续；重复 callback 不重复 block；部分失败可重试；UI 显示真实状态。
- 工作范围：L，QStash/worker + status API + Web。

### P0-11 诚实产品状态与无效控件清理

- 任务描述：移除未标注 demo trip、假票务稀缺、固定 `Online`；接通或删除 Add Block、+Day、Route、quick replies；Readiness 不得由假数据驱动。
- 前置依赖：P0-07。
- 验收标准：未生成时显示明确 onboarding/empty state；无可用能力不显示按钮；demo 模式显著标注；不出现虚构实时事实。
- 工作范围：M，Web Copilot UI/tests。

### P0-12 Web 全站 Shell 与移动 Copilot 信息架构

- 任务描述：Copilot、Explore、Guides、Human Help 共享 header/footer/trust links；移动端采用 Chat/Trip 分段切换或 sticky composer，避免对话入口落在长画布下方。
- 前置依赖：P0-11。
- 验收标准：375/768/1280/1440 无溢出；移动首屏可直接提问；导航和品牌一致；焦点与键盘路径可用。
- 工作范围：M，Web layout/styles。

### P0-13 Explore 真实 Fact 卡片（现有 #57）

- 任务描述：Explore 从 DB/service 读取 current facts；展示最多 3 个可执行标签、来源时间和明确 CTA。
- 前置依赖：P0-06、P0-08。
- 验收标准：无事实则不显示；过期事实消失；5 类数据结构可用；不编评分/评价数/价格。
- 工作范围：M。

### P0-14 SEO 数据接入与索引质量门槛（现有 #59/#84/#85/#86）

- 任务描述：把 POI/guide 页面改为 DB fact + editorial override；用 minimum fact coverage、source、review status 决定 index/noindex；补 canonical/robots/schema.org。
- 前置依赖：P0-08、P0-13。
- 验收标准：首批 20 个高质量页面可索引；空/重复/未审核页 noindex；sitemap 使用真实 `SITE_URL` 和更新时间；不以“凑 200 页”为验收。
- 工作范围：XL，必须拆成 schema、data、editorial、index 四个 PR。

### P0-15 Human Task DB 持久化（现有 #60）

- 任务描述：公开表单、server task service、Ops 统一写 `human_tasks`；匿名/登录身份和联系人最小化保存。
- 前置依赖：P0-03、P0-05、P0-06。
- 验收标准：提交后 Ops 可见；刷新/冷启动不丢；重复提交受幂等/rate limit 保护；错误不假装成功。
- 工作范围：M。

### P0-16 Human Task 状态机与详情（现有 #61/#62）

- 任务描述：收敛合法状态迁移；建设 task detail、operator note、报价、审计日志；用户端只显示可公开状态。
- 前置依赖：P0-15。
- 验收标准：非法迁移 409；每次状态变化可追踪；联系人不出现在公共页面；“Phase 0”内部术语从用户 UI 移除。
- 工作范围：M。

### P0-17 Stripe Checkout/Payment Link + Webhook（现有 #64/#65）

- 任务描述：Ops 通过 Stripe API 创建支付链接/Checkout Session；metadata 绑定 task；webhook 验签、幂等并写 payment ledger。
- 前置依赖：P0-16、收款主体硬决策。
- 验收标准：测试模式完整跑通 quote→checkout→paid；重复 webhook 不重复入账；失败/退款有状态；secret 仅在环境变量。
- 工作范围：L。

### P0-18 Affiliate Outbound 真实账本与激活门（现有 #58/#66/#67/#68）

- 任务描述：DB 持久化 click；只有 approved/active partner 可展示/跳转；使用合作方真实 affiliate link 模板和 sub-id，不把 `vp_click_id` 当成 affiliate 资格。
- 前置依赖：P0-02、P0-05、至少一家 partner 审批完成。
- 验收标准：pending/inactive 完全不可公开跳转；host allowlist；click id 可与 partner report 对账；披露邻近 CTA。
- 工作范围：L。

### P0-19 统一 Telemetry 持久化与三条漏斗（现有 #70/#71/#87/#88/#89）

- 任务描述：建立非阻塞 DB helper；接 Copilot、Explore/Guide/Outbound、Human Help 事件；规范 action registry 和 PII allowlist。
- 前置依赖：P0-06、P0-15、P0-18。
- 验收标准：主流程不因埋点失败；可查询 prompt→trip、guide→outbound、task→paid；不记录 prompt/contact 原文。
- 工作范围：L。

### P0-20 运行安全与可观测性（现有 #72/#90/#91）

- 任务描述：provider/env health、Sentry、Error Boundary、anon/user rate limit、token budget、Human Help anti-spam。
- 前置依赖：P0-07、P0-15。
- 验收标准：超限 429；缺 provider 显示 degraded；500 可追踪且不泄密；Ops/admin 有独立限制。
- 工作范围：L。

### P0-21 Legal、Runbook 与 Public Smoke Test（现有 #75/#92/#93）

- 任务描述：Privacy、Terms、Affiliate Disclosure、Human Help/Emergency Disclaimer；部署/迁移/回滚/任务处理/知识复核 runbook；端到端 smoke。
- 前置依赖：P0-17 至 P0-20。
- 验收标准：匿名生成→持久化→citation→outbound→Human Task→支付→Ops→telemetry 全链通过；每步有日志或截图；无 P0 安全问题。
- 工作范围：L。

## 3.2 P1：验证增长与形成数据壁垒

### P1-01 POI Fact 证据链升级

- 任务描述：增加 source URL/type、evidence、verifiedBy、review policy；用户界面显示 last verified。
- 前置依赖：P0-08。
- 验收标准：每个公开执行事实可追溯；官方/商户/人工验证可区分；到期自动退出。
- 工作范围：M。

### P1-02 China Readiness Check

- 任务描述：2-3 分钟诊断支付、网络、手机兼容、实名票、交通 App、紧急准备；生成可执行清单和适度 affiliate CTA。
- 前置依赖：P0-12、P0-18、P0-19。
- 验收标准：无需登录可完成；结果可保存到 trip；每个建议有依据；可测完成率与 CTA 转化。
- 工作范围：L。

### P1-03 Arrival Pack

- 任务描述：把首日行程、酒店中文地址、支付/网络步骤、应急卡导出为可打印/可离线保存的 pack。
- 前置依赖：P1-02、P0-14。
- 验收标准：无网络可读；不含敏感 token；分享/下载有埋点；内容有版本和更新时间。
- 工作范围：M。

### P1-04 Rescue Mode v1

- 任务描述：提供“我现在卡住了”入口，按支付/交通/语言/票务/健康风险分流到固定工具、官方渠道或 Human Task。
- 前置依赖：P0-15、P0-20。
- 验收标准：高风险不做诊断；用户确认后才提交人工任务；可携带 trip/block 上下文但不泄露无关数据。
- 工作范围：L。

### P1-05 Human Task Transcript → Knowledge（现有 #63）

- 任务描述：保存脱敏处理记录和完成证据；从重复问题生成 gap/fact 草稿，必须人工审核后发布。
- 前置依赖：P0-16、P1-01。
- 验收标准：原始联系人不进入知识库；fact 草稿可追溯到 task；运营可拒绝/编辑。
- 工作范围：M。

### P1-06 Affiliate 申请与验证包（现有 #98）

- 任务描述：用真实点击/城市/意图数据申请 Airalo、Trip.com、Klook、Viator/GetYourGuide；记录审批、条款和 sub-id 规则。
- 前置依赖：P0-18、至少 4 周真实数据。
- 验收标准：只报告真实数据；至少一家正式批准；每家有 partner config 和归因测试。
- 工作范围：运营 M + 工程 S。

### P1-07 Creator Deep Links（现有 #99）

- 任务描述：为 China travel creator 建 source/creator attribution、专属 landing、行程分享模板和报告。
- 前置依赖：P0-19、P1-06。
- 验收标准：跨 guide/share/outbound 保留 attribution；不会覆盖最终商业 click id；可按 creator 看激活和付费。
- 工作范围：M。

### P1-08 Human Task 单位经济学与定价实验

- 任务描述：按 operator 分钟、支付费、失败/退款 reserve、目标毛利计算价格底线；测试 fixed price 与 quote 两种入口。
- 前置依赖：至少 20 个真实 task。
- 验收标准：每类 task 有 median handling time、completion rate、refund rate、gross margin；没有数据不推出长期套餐。
- 工作范围：产品/运营 M + 工程 S。

### P1-09 红金设计系统成为唯一视觉真理源

- 任务描述：将 red-gold 文档从 candidate 升为 active；废弃/归档其它冲突版本；把跨 Web/Ops/Mobile token 提取到 `packages/ui`，加入真实中国执行场景图片规范。
- 前置依赖：P0-12。
- 验收标准：Copilot/Explore/Guides/Human Help 共用 token；无硬编码漂移；无节庆化中国元素；图片有授权和 alt。
- 工作范围：M。

### P1-10 六城知识库与批量导入（现有 #81/#82）

- 任务描述：先定义覆盖率和来源标准，再做 CSV dry-run/import/dedupe；城市扩展由 gap/流量排序，不按名单平均铺开。
- 前置依赖：P1-01、真实城市需求数据。
- 验收标准：无效行不写入；重复 POI 可合并；每城公开前达到最低 fact coverage；缺失保持空。
- 工作范围：L。

### P1-11 Phase 1 Trigger SQL（现有 #100）

- 任务描述：同时看 WAU、Copilot success、Human Task 数、重复访客和城市分布，决定是否启动 App。
- 前置依赖：P0-19。
- 验收标准：一条查询给出触发与否及证据；不能只因 200 个低质量访问启动 Mobile。
- 工作范围：S。

## 3.3 P2：触发后 Mobile、订阅与供给侧

### P2-01 Expo Shell + Mobile Tokens（现有 #94/#95）

- 任务描述：Today/Tools/Help/Me 四面，消费共享 domain/ui；先只读，不复制 Web 全功能。
- 前置依赖：P1-11 判定触发。
- 验收标准：iOS/Android simulator 可运行；共享 schema；导航和红金 token 一致。
- 工作范围：L。

### P2-02 Offline Trip Package + Sync + Cache（现有 #76/#77/#78）

- 任务描述：定义离线包、只读同步、损坏恢复和 last-updated；编辑仍走受控 Patch。
- 前置依赖：P2-01、P0-04。
- 验收标准：断网可看当前行程；恢复网络不覆盖较新版本；无 token 进入缓存。
- 工作范围：XL，拆 3 个 PR。

### P2-03 Tools Pack + Show to Local（现有 #79/#96）

- 任务描述：Payment、Network、Emergency、Transport、Entry、Currency、Translation、Offline；固定双语卡本地可用。
- 前置依赖：P2-01、P1-01。
- 验收标准：离线可用；文案有版本/审核日期；高风险内容有官方渠道。
- 工作范围：L。

### P2-04 Mobile Human Help + Telemetry（现有 #80/#97）

- 任务描述：复用同一 task API；离线不伪造提交；事件本地 queue 后补发。
- 前置依赖：P2-01、P0-15、P0-19。
- 验收标准：task id 真实返回；匿名/登录策略一致；不记录用户输入原文。
- 工作范围：M。

### P2-05 App Store/Play Store 资料与 Smoke（现有 #83/#101）

- 任务描述：商店素材、隐私标签、support/privacy URL、真实功能描述、双端验收脚本。
- 前置依赖：P2-02 至 P2-04。
- 验收标准：资料不承诺未上线能力；离线/登录/Human Help 全链验证。
- 工作范围：M。

### P2-06 Execution Pass Entitlement + RevenueCat

- 任务描述：把数字权益与人工服务拆成两个 SKU 体系：数字离线/AI 权益走 IAP/RevenueCat；真实人工服务走 Stripe。
- 前置依赖：真实付费任务数据、App 上线、法务确认。
- 验收标准：purchase/restore/manage purchases/entitlement ledger 齐全；Web/App 权益一致；无混合支付歧义。
- 工作范围：L。

### P2-07 定制询价与白名单旅行社

- 任务描述：Quote 对象、需求快照、旅行社白名单、lead assignment、lead fee 账本；不做开放商家注册。
- 前置依赖：单城 ≥5 个/月真实询价。
- 验收标准：用户确认后才发线索；供应方资质可审计；佣金/lead fee 可追踪。
- 工作范围：XL，按 domain/server/ops 分拆。

### P2-08 Affiliate CSV 对账（现有 #69，建议从 Phase 0 下调）

- 任务描述：只有真实 partner 报表产生后才做 CSV import、matched/unmatched 和 commission ledger。
- 前置依赖：至少一家 partner 有连续两个月真实结算。
- 验收标准：不修改原始 click；负数/取消/延迟归因可处理；差异可人工复核。
- 工作范围：M。

---

# 第四章：设计变更与创新思路

## 4.1 原有产品规划需要修改、删减、增补的内容

| 原规划                         | 修订                                                               | 理由                                                       |
| ------------------------------ | ------------------------------------------------------------------ | ---------------------------------------------------------- |
| Phase 0 目标约 200 个 SEO 页面 | 先发布 20 个满足质量门槛的页面，再按表现扩展                       | Google 明确打击无新增价值的 scaled content；数量不是护城河 |
| V2-02~35 关闭即视为该能力完成  | 增加 Contract/Demo/Production 三层 DoD                             | 当前多个“完成项”仍是 stub/memory                           |
| Supabase Auth 是基础设施项     | 提升为 P0 安全主线                                                 | 当前客户端自报 userId，已形成越权风险                      |
| `apps/server` Phase 0 独立部署 | Phase 0 作为共享 server module 随 Web/Ops 部署；Phase 1 再独立 API | 当前规模下更省运维，且符合模块化单体                       |
| Affiliate CSV 对账在 Phase 0   | 下调到真实结算产生后的 Phase 2                                     | 无流水时建设对账属于提前优化                               |
| Trip Pass 三档                 | Human Task 先验证；之后拆数字 Execution Pass 与人工服务 credit     | 避免 Apple 合规混淆，也避免用“更多 AI 次数”制造弱价值      |
| Readiness 百分比               | 改为可解释的执行准备项，不以 block 数量代替                        | 当前 50% 会制造虚假确定感                                  |
| Chat 不主动商业推荐            | 保留并升级为排名独立性规则                                         | 防止佣金影响信任和推荐质量                                 |
| Knowledge gaps 存问题模式      | 增加脱敏、hash、频次和人工审核                                     | 原始问题可能含联系方式、证件或健康信息                     |

应删除或延后：

- 任何没有真实动作的按钮和“即将支持”假入口。
- 未经验证的票务紧迫性、库存、价格、评分和支付接受度。
- 在真实流量前建设自动佣金对账、开放商家入驻、复杂 BI dashboard。
- 以“AI 规划能力强”为主的营销内容。

应增补：

- 身份与所有权安全 ADR。
- Demo/staging/production 运行模式 ADR。
- Fact provenance 和内容审核 SLA。
- Human Task 服务边界、营业时间、响应预期和退款政策。
- SEO index quality policy。

## 4.2 新增功能、商业模式、品牌营销的创新想法

### 1. China Readiness Check

这是比“生成行程”更强的免费获客钩子。用户回答 8-12 个问题后得到：

- 支付准备度
- 网络准备度
- 手机/App 准备度
- 实名票和护照姓名风险
- 首日交通准备度
- 应急信息完整度

每个未完成项进入 Prepare checklist；只有明确购买意图时才出现 eSIM/票务 partner CTA。它同时贡献 lead、偏好、知识 gap 和 affiliate 转化数据。

### 2. Execution Proof

不要展示泛化的“4.7 分”，而展示外国游客真正需要的事实：

- Passport booking required
- Foreign card recently verified
- Chinese phone number required
- English menu available
- Metro exit and walking complexity
- Last verified date

这是 VisePanda 能与 OTA 评分体系错位竞争的产品层。

### 3. Rescue Mode

“我的支付失败了”“我找不到入口”“司机不理解地址”“票名不匹配”等情况进入快速分流：

```text
固定步骤/Show to Local
  → 官方渠道
  → Copilot 解释
  → 用户确认后 Human Task
```

Rescue 是最接近付费意愿的时刻，但必须先明确可服务城市、时间和 SLA，不能宣传 24/7 后再人工失联。

### 4. Arrival Pack

在出发前生成一个离线包：酒店中文地址、首日路线、支付和网络步骤、应急短语、关键确认号。Web 用户可打印或保存，未来 App 直接同步。这比单纯“下载 App”更低阻力。

### 5. Confidence Receipt

每次 Copilot 重要建议附一个可展开的“Why this is reliable”：来源、最后核实时间、哪些字段未知、是否含 partner link。它让结构化 AI 的技术优势转化为用户可感知的信任。

### 6. Human Task → SOP → 自动化

每种人工任务累计 20-50 单后再判断能否产品化：

- 重复度高、低风险：做固定工具或模板。
- 重复度高、需电话：形成 operator SOP。
- 低频高风险：继续人工并提高价格。
- 无法稳定履约：下线，不靠 AI 掩盖。

### 7. Creator Execution Pack

与 China travel creator 合作时，不提供普通优惠码页面，而提供其视频对应的“可执行行程 + 中国准备清单 + partner disclosure”。创作者获得归因，VisePanda 获得高意图用户，内容又能反哺 SEO。

### 8. 定价原则

Human Task 不应先拍脑袋定 $14.99。价格底线应来自：

```text
(处理分钟 ÷ 60 × 全成本时薪 + 支付费 + 失败/退款准备金)
÷ (1 - 目标毛利率)
```

早期可测试：

- Simple confirmation：固定低价。
- Booking/translation task：按复杂度报价。
- Urgent rescue：更高固定起价。
- Customized trip：lead fee，不自己承担完整履约。

---

# 第五章：竞品调研 + 头脑风暴成果

## 5.1 竞品最新动态总结

### AI 规划与执行竞品

| 产品               | 当前强项                                                                 | 对 VisePanda 的压力                      | 可利用的空位                                           |
| ------------------ | ------------------------------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------ |
| Trip.com TripGenie | 行程、库存、酒店/机票/活动跳转、翻译、协作、提醒、售后；依托自有交易数据 | 最大结构性威胁，尤其在中国供给和预订闭环 | OTA 不擅长中立地处理碎片化执行失败和跨平台准备         |
| Mindtrip           | 对话规划、照片/地图/评论、协作、收据导入、Creator/B2B                    | 视觉与内容组织成熟                       | 中国执行事实和人工救援深度有限                         |
| Layla              | 免费规划、实时价格、合作方预订、人工 agent，Premium 约 $49/年            | 已把“AI + 人”作为卖点                    | 聚焦全球行程，不具备中国支付/网络/实名票的垂直知识     |
| Wanderlog          | 免费协作规划；$39.99/年提供离线、路线优化、地图导出、无限 AI             | 离线与 organizer 心智强                  | 不主攻中国落地执行和人工兜底                           |
| GuideGeek          | WhatsApp/Instagram 等低摩擦入口，免费 C 端；向品牌/DMO 提供定制 AI       | 获客成本低，B2B 商业模式清晰             | 通用问答缺少 VisePanda 的结构化 Trip/事实验证/任务闭环 |
| ChatGPT/通用 AI    | 免费规划、搜索、富卡片、商业比较，逐步进入预订                           | “AI 规划”本身将继续降价到零              | 专有执行数据、履约和本地操作工具仍可差异化             |

证据来源：

- TripGenie 已公开提供定制行程、预订导流和旅中支持，并持续加入实时翻译、菜单、位置推荐等能力。[TripGenie 产品页](https://www.trip.com/tripgenie/) · [Trip.com 2025 翻译更新](https://jp.trip.com/newsroom/tripgenie25update-jp/)
- Mindtrip 已覆盖推荐、地图/评论、协作、确认单导入、Google Pins 和 creator 体系。[Mindtrip](https://mindtrip.ai/)
- Layla 对外主张实时价格、Booking/Skyscanner/GetYourGuide/Viator 合作和 $49/年高级版。[Layla](https://layla.ai/)
- Wanderlog Pro 的主要付费点是离线、路线优化、地图导出、自动导入和无限 AI，公开价 $39.99/年。[Wanderlog Pro](https://wanderlog.com/pro)
- GuideGeek 以免费消息渠道获客，并把定制 AI 卖给 DMO/品牌，说明 B2B white-label 是长期可选收入，不是 Phase 0 主线。[GuideGeek](https://guidegeek.com/social)

### Affiliate 可行性

| Partner      | 官方公开条件                                                                | 对 VisePanda 的建议                                     |
| ------------ | --------------------------------------------------------------------------- | ------------------------------------------------------- |
| Trip.com     | 个人/公司均可申请；基础佣金最高约 7%；Web cookie 30 天；$200 门槛，结算较慢 | 尽早申请，但现金流不能依赖它                            |
| Airalo       | 标准佣金约 10%；门槛低；有 dashboard、discount code、API/SDK/联名方案       | Phase 0 最优先验证，和 Readiness/Network 高意图天然匹配 |
| Viator       | 完成订单约 8%；30 天 cookie；可从 links 逐步升级 Affiliate API              | 体验类目的优先补充                                      |
| GetYourGuide | Creator affiliate 最高约 8%，30 天归因                                      | 可与 creator 合作并行验证                               |
| Klook        | 提供 affiliate code、widgets、dashboard 和 performance bonus                | 中国/亚洲体验供给重要，但真实比例以审批后条款为准       |

官方来源：[Trip.com Affiliate](https://www.trip.com/partners) · [Airalo Affiliate](https://partners.airalo.com/solutions/affiliates) · [Viator Affiliate](https://partnerresources.viator.com/) · [GetYourGuide Creator Affiliate](https://partner.getyourguide.support/hc/en-us/articles/23082933149981-How-to-get-started-with-the-Affiliate-Program-as-a-Creator) · [Klook Affiliate](https://affiliate.klook.com/)

结论：affiliate 可在早期证明意图和降低 CAC，但无法单独承担公司利润。Trip.com 的最低支付门槛和结算周期也说明，必须把 outbound 数据当作“需求温度计”，Human Task/lead fee 才是更直接的收入验证。

### AI UI 与 SEO 趋势

AI 产品界面正在从“一个聊天气泡”转向消息、来源、工具调用、动作和状态的组合。Vercel AI Elements 已把 sources、tools、workflow、status 等作为标准组件，这与 VisePanda 的 Envelope + Canvas 路线一致。[AI Elements](https://elements.ai-sdk.dev/) · [Sources component](https://elements.ai-sdk.dev/components/sources)

与此同时，Google 明确把“为了排名批量生成、却不给用户新增价值的页面”定义为 scaled content abuse。因此 programmatic SEO 必须以独有 fact、来源、人工复核和明确用户任务为索引门槛，不能把“200 页”当成功指标。[Google Search spam policies](https://developers.google.com/search/docs/essentials/spam-policies)

Apple 当前仍区分数字权益与真实世界/人与人服务：数字内容和能力通常适用 IAP，线下消费的实体服务或特定实时人与人服务可以使用其它支付方式。因此未来必须拆分 Execution Pass 与 Human Task SKU。[Apple App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/)

## 5.2 可落地的差异化创意方案

### 最终差异化定位

> **VisePanda 不与 Trip.com 比库存，不与 ChatGPT 比知识广度，不与 Wanderlog 比通用行程编辑。它专门把“外国人在中国会卡住的执行节点”变成可验证事实、可执行工具和可付费解决任务。**

### 护城河顺序

1. **Failure-mode graph**：什么用户、在哪个城市、哪个步骤、为什么失败、怎样解决。
2. **Verified execution facts**：不是泛评分，而是护照、外卡、手机号、入口、地铁、预约规则。
3. **Human resolution transcripts**：人工任务解决记录转成 SOP 和知识草稿。
4. **Trust architecture**：来源、核实时间、未知项、商业披露和推荐排序隔离。
5. **Distribution**：高意图 SEO、creator execution pack、trip share。
6. **Operator network**：当任务量足够时形成有限城市的可靠服务供给。

### 大公司覆盖风险

Trip.com 已经具备 AI、库存、翻译、提醒和中国供应链，完全可能覆盖普通规划和部分工具。VisePanda 不应以功能数量防守，而应以更窄、更深、更可信的执行数据防守：

- 不做“附近餐厅推荐”，做“这家是否需要中国手机号/是否支持外卡/怎么向司机展示地址”。
- 不做“行程生成更漂亮”，做“每个行程块离执行还缺什么”。
- 不做“万能客服”，做“能否解决、多久解决、多少钱解决”的诚实任务承诺。
- 不让佣金决定推荐排序；商业合作只影响 CTA 可用性，不影响事实和 fit 排名。

### 增长玩法

1. 支付失败、eSIM、故宫实名票、机场到市区等高痛点页面，优先于泛 POI 页面。
2. Readiness Check 作为 SEO 页的统一激活 CTA，而不是每页都要求注册。
3. 公开分享页附“Make this executable for my trip”，把内容访问转成 Copilot 会话。
4. Creator 视频 description 进入专属 execution pack，按 trip created/human task paid 而非纯点击衡量。
5. Human Task 完成后邀请用户提交“是否解决”和一句结构化反馈，积累可信 proof，不急做公开社区。

---

# 第六章：修订版项目发展路线图

## 6.1 修正后的 MVP 迭代计划

### Sprint 0：停止伪完成，封住安全边界

目标：从“任何人可自报身份的 demo”变成安全的 staging。

- P0-01 Node 22
- P0-02 migration/RLS/advisors
- P0-03 Auth + signed anonymous session
- P0-04 Trip owner/concurrency
- P0-05 Ops RBAC
- P0-11 truthful UI

退出条件：无已知 BOLA；production 不静默使用 memory；UI 不显示虚构实时事实。

### Sprint 1：让 Copilot 第一次真正工作

- P0-06 production adapters
- P0-07 real LLM providers
- P0-08 retrieval/citations
- P0-09 trace/cost
- P0-10 durable completion
- P0-20 provider health/rate limit/Sentry 基础

退出条件：至少 20 条真实测试问题通过；trip patch schema success ≥95%；无知识时能诚实拒答；fallback 有实测证据。

### Sprint 2：跑通第一笔收入路径

- P0-15 Human Task DB
- P0-16 state/detail
- P0-17 Stripe test/live readiness
- P0-18 active partner outbound
- P0-19 telemetry
- P0-21 legal/runbook 部分

退出条件：真实 operator 能从 request 处理到 done；Stripe 测试付款与 webhook 对账完整；至少一家 affiliate 有正式 tracking 规则。

### Sprint 3：建立低 CAC 获客面

- P0-12 global shell/mobile web
- P0-13 Explore facts
- P0-14 首批 20 个高质量 indexable pages
- P1-02 Readiness Check MVP
- P0-21 full smoke

退出条件：20 页全部有独有事实、来源、更新时间和明确用户任务；Search Console 可提交；从 page view 到 readiness/trip/task/outbound 可追踪。

### MVP 公开上线硬门槛

1. 安全：Auth/owner/RLS/Ops RBAC 无 P0 问题。
2. 真实性：真实 AI、真实 DB、真实 citation；无 key/失败不伪造。
3. 商业：至少 Human Task 或一家 active affiliate 跑通真实闭环。
4. 运营：有任务处理、知识复核、部署回滚 runbook。
5. 质量：Copilot success、schema pass、P95 latency、cost/request 可观测。
6. 获客：至少 20 个高质量页面，不以页面数量充数。

按当前状态估计，单一主工程 Agent 配合并行审查约需 4-6 周；若身份安全、AI、商业三条线并行，可缩短日历时间，但不可跳过依赖。

## 6.2 V2.0 迭代内容

Phase 1 不再只看“WAU ≥200 或 Human Task ≥20”，建议增加质量条件：

- 最近 4 周 WAU ≥200，或有效 Human Task ≥20。
- Copilot 成功返回且 patch 合法 ≥85%。
- 至少 20% 的激活用户在出发前或旅中二次访问。
- 至少一个城市出现稳定的 task/outbound 集中度。
- 无未关闭 P0 安全/履约问题。

满足后进入：

1. Expo Today/Tools/Help/Me。
2. Read-only trip sync + 离线包。
3. Show to Local 和八件套。
4. Rescue Mode 移动入口。
5. 按需求排名扩 2-4 个城市，不机械一次扩满六城。
6. creator deep links 和正式 affiliate 谈判。
7. 真实任务单位经济学完成后再测试 Execution Pass。

## 6.3 长期发展规划

### Phase 2：服务网络与定制利润

触发：单城定制询价 ≥5/月，重复访客可测，Human Task 有正毛利。

- Quote marketplace（白名单旅行社）。
- 任务分类、SOP、operator quality score。
- Execution Pass 定价实验。
- creator/agency B2B lead distribution。
- 有真实结算后再建设 CSV reconciliation。

### Phase 3：有限平台化

触发：月撮合 ≥100、法务实体和跨境结算就绪。

- 服务者分层和有限自助入驻。
- commission/settlement ledger。
- dispute/refund/quality review。
- Partner API/white-label execution knowledge。

### 长期可选方向

- 面向 DMO、酒店集团、航空/机场服务方输出“China execution knowledge + Copilot”白标能力。
- 将 failure-mode graph 作为 B2B API，而不是出售原始用户对话。
- 扩展到其它“数字基础设施特殊”的目的地前，必须先证明中国单市场单位经济学。

## 6.4 更新后的风险清单及应对方案

| 风险                   | 等级 | 当前表现                                      | 应对                                           |
| ---------------------- | ---- | --------------------------------------------- | ---------------------------------------------- |
| 身份越权/BOLA          | 极高 | 客户端自报 userId，trip save 未强校验 owner   | P0-03/P0-04，安全测试阻断上线                  |
| Ops 数据泄露           | 极高 | 无登录/RBAC                                   | Ops 独立部署、RBAC、最小字段                   |
| AI 仍为 stub           | 极高 | 产品价值无法验证                              | P0-07/P0-08，真实 eval 和成本观测              |
| Serverless 内存丢失    | 高   | task/outbound/telemetry 分叉                  | P0-06，production DB-only                      |
| 数据库策略漂移         | 高   | 多张 public table 无 RLS/grant                | migration replay + advisors + policy tests     |
| Node 20 EOL            | 高   | CI/engine 仍为 20                             | 立即升级 22                                    |
| 模型成本或超时         | 高   | 无 rate limit、真实时延未知                   | effort 路由、budget、fallback、durable job     |
| 知识过期/编造          | 高   | 指南无 provenance，Copilot stub citation      | fact evidence、expiry、no-source no-claim      |
| Human Task 履约失败    | 高   | 无 SLA/排班/退款流程                          | 限城市/时段、任务分级、价格 reserve、runbook   |
| Affiliate 归因损耗     | 中高 | 只有自定义 click id，无正式 partner 资格      | 先审批、真实 sub-id、按结算折价预测            |
| Trip.com/通用 AI 覆盖  | 高   | 竞品已进入翻译、预订、提醒                    | 深耕 execution facts、rescue、operator data    |
| SEO 被判低价值规模内容 | 高   | 原目标强调 200 页                             | 20 页质量门槛、editorial review、noindex       |
| Apple 支付合规         | 中   | Mobile 尚未开始                               | 拆数字权益与真实服务 SKU，StoreKit/Stripe 分路 |
| 创始人运营带宽         | 高   | Human Task 需要人工                           | 明确营业时间、任务上限、只开放可履约城市       |
| PIPL/GDPR/敏感数据     | 高   | contact/prompt/trace 尚无 retention/redaction | 数据最小化、脱敏、保留期、删除流程             |

建议唯一 North Star Metric：

> **Execution Success Rate：被用户确认“已解决/可执行”的关键旅行节点 ÷ 用户尝试解决的关键节点。**

辅助指标：

- 获客：高意图自然流量、Readiness 完成率。
- 激活：首次会话生成合法 trip + 至少一个真实 citation。
- 信任：citation 展开、share/save、unknown honesty rate。
- 商业：outbound EPC、task submitted→paid→done、task 毛利。
- 留存：出发前→旅中回访、第二个城市/第二次来华。
- 质量：fact freshness、Copilot schema pass、hallucination rate、P95 latency、cost/successful task。

最终建议：**冻结新功能扩张 1 个短周期，先完成 P0-01 至 P0-11。只要身份安全、真实 AI 和 production persistence 没有完成，任何更多页面、Mobile 或订阅功能都会放大错误，而不会放大商业价值。**
