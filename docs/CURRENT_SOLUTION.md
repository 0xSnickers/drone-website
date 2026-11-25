# 当前方案

更新日期：2026-11-25（Asia/Shanghai）。范围：当前工作区代码，包含第一批优化；本轮尚未执行生产发布。开发状态与验证记录见[开发进度](DEVELOPMENT_PROGRESS.md)。

## 1. 总体结构与业务范围

项目采用两个独立 React SPA、一个共享监控 SDK、一个 Django 模块化单体和一个独立压测 CLI。当前继续维护这些边界，暂不拆分微服务。

- `web/`：无人机官网，React 19 + Vite，开发端口 `5173`。提供产品展示、学院、社区、商城展示与会员入口。
- `admin/`：监控与管理后台，React 19 + Vite，开发端口 `5174`。提供项目、用户管理、访问分析、埋点、前端异常、服务日志、IP 与实时系统 / 压测瓶颈状态查询。
- `sdk/`：零第三方运行时依赖的浏览器监控与 Node 日志 SDK；两个前端通过 `monitor-sdk` 别名引用源码。
- `server/`：Django 5.2 + DRF，开发端口 `9000`。按 `apps/core`、`apps/auth`、`apps/users`、`apps/monitor` 划分模块，默认开发数据库可回落 SQLite，生产编排提供 PostgreSQL 16。
- `stress-test/`：独立 Node.js + TypeScript CLI，负责 HTTP、浏览器、SDK 上报与混合负载测试，输出 HTML / Markdown / JSON 报告。

官网的预约、SN 校验、结算等部分交互仍使用本地状态或定时器模拟，课程与社区内容主要来自静态数据。当前不能将其视为已完成订单、支付、预约或内容管理后端。

## 2. 前端分层与状态边界

页面位于 `src/pages`，路由按需加载，页面负责组合 `features/<模块>` 暴露的组件和 hook。模块外经 `index.ts` 使用业务能力。

- 服务端数据由 TanStack Query 管理，Query Key 在模块内组织。
- 组件内临时状态使用 React 状态；跨页面客户端状态由 Zustand 管理。
- 请求经 `services/http`，环境变量经 `config/env`，遥测经 `services/telemetry`。
- 文案进入 i18n 语言包，样式使用语义主题 Token。
- 当前生成后的 `core` 归本项目所有；两个前端仍各自保存基础层代码，尚未完成共享逻辑与测试治理。

监控后台统一使用全局项目、时间范围和时区筛选；刷新时保留上一份查询数据。官网通知仍混在购物车 store 内，长组件与跨领域依赖是下一批改进事项。

## 3. 身份与权限

官网和后台共用用户表，但访问令牌与刷新会话按端受众（`aud`）物理隔离：官网使用 `/api/v1/auth/*`（`aud=web`、`refresh_token` HttpOnly Cookie），后台使用 `/api/v1/admin/auth/*`（`aud=admin`、`admin_refresh_token` HttpOnly Cookie），两端登录、刷新与登出互不影响。

- `user`：官网会员。公开注册始终创建此角色，即使提交 `role=admin` 或 `role=monitor_viewer` 也不会得到监控权限；尝试登录后台返回 `403 ADMIN_ACCESS_REQUIRED`。
- `monitor_viewer`：管理员显式授予的只读监控人员，可登录后台读取全部项目及其监控数据，不能执行项目、异常状态、IP 黑名单等写操作，也不能修改用户。
- `admin`：监控读写与用户管理。

未登录访问受保护接口返回 `401 UNAUTHORIZED`；已登录但角色不足或携带官网 `aud=web` 令牌访问监控接口返回 `403 FORBIDDEN`。后台路由守卫提前显示权限不足提示，`/register` 转到登录页；官网个人页仅展示当前登录会员自身资料，用户管理与 JWT 会话状态收归后台。

当前是单组织权限模型，没有项目成员表与租户隔离。只读监控人员可以读取全部项目；后续若引入多团队，必须补充项目授权范围及列表、详情、聚合的一致校验。

实现入口：[鉴权权限类](../server/apps/auth/authentication.py)、[鉴权视图](../server/apps/auth/views.py)、[用户接口](../server/apps/users/views.py)、[后台路由守卫](../admin/src/features/auth/components/RouteGuards.tsx)。

## 4. 查询与输入校验

监控统计和明细接口经 `MonitorQuerySerializer` 校验项目 UUID、时间范围、分页及部分筛选枚举；非法输入返回 `400 VALIDATION_ERROR`，避免直接传入 ORM 后变成 500。时区仍遵循契约，无法解析时回落 UTC。

项目、异常、日志等业务数据使用统一响应体 `{ code, message, data }`；完整字段与错误码见[接口契约](../server/docs/API_CONTRACT.md)。

当前多个监控统计仍遍历时间窗内的明细，用 Python 的集合、计数器和列表聚合；部分逻辑先读取全部记录再分页。数据库侧聚合、增量时间桶、查询性能基线尚未完成。

实现入口：[查询 Serializer](../server/apps/monitor/serializers.py)、[查询上下文](../server/apps/monitor/views/query_params.py)、[统计服务](../server/apps/monitor/services/analytics.py)。

## 5. 监控接收与队列交付

`POST /api/v1/ingest/events` 与 `/ingest/logs` 为公开接收接口，通过可公开的 appKey 识别项目；监控数据读取仍要求监控角色。服务端按客户端 IP 限流，并校验 appKey、黑名单和载荷。

### 5.1 直接写入

默认 `INGEST_MODE=direct`，验证后同步写入数据库。数据库不可用仍会导致上报失败；前端 SDK 对网络错误、429 与 5xx 重试，缓冲队列有容量上限。

### 5.2 Redis Streams

配置 `INGEST_MODE=redis_queue`、`REDIS_URL` 并单独启动 worker 后：

1. 每批生成 `job_id`，有容量空间才写入 Redis Stream；`accepted` 表示接收或入队，并非已经落库。
2. 消费者经消费组领取任务，任务在确认前保留；失联后超过可见性超时可重新领取。
3. 业务数据与 `ingest_receipts` 批次收据在同一数据库事务提交。
4. 提交后才确认并删除 Stream 条目。重复领取、ACK 丢失与入队响应丢失引起的同批次重放，通过收据避免重复落库。
5. 队列满载返回 429，保留已接收任务；不再裁剪旧任务。

当前消费组名为 `persist`，新 Stream 在原队列名后追加 `:v2`。旧 List 数据由新 worker 分批原子迁移，升级前应先停止旧 worker。非法载荷保留在 pending 并记录错误，尚未实现自动死信队列和人工处置界面。

实现入口：[队列](../server/apps/monitor/services/queue.py)、[事务与去重](../server/apps/monitor/services/ingest.py)、[消费者](../server/apps/monitor/management/commands/run_ingest_worker.py)。

### 5.3 配置与故障边界

- `INGEST_QUEUE_MAXLEN`：默认每个新 Stream 上限 `50000`；旧 List 迁移期间需要额外预留 Redis 空间。
- `INGEST_VISIBILITY_TIMEOUT_MS`：默认 `60000`，应高于最长单批事务耗时。
- `REDIS_TIMEOUT_MS`：默认 `200`；故障后当前进程熔断 30 秒，并回落本地限流。
- `INGEST_FALLBACK_SAMPLE_RATE`：默认 `0.2`；队列故障降级时行为事件采样直写，异常全量尝试写入，日志直接写库。
- Compose 中 Redis 启用 AOF、`noeviction`。持久性仍依赖 Redis 配置、磁盘与基础设施。

降级采样是有损策略，不能把 `accepted` 解读为全量保留。当前批次去重不涵盖 HTTP 客户端重新发送时生成的新批次，不提供端到端 exactly-once 保证。数据库与 Redis 同时故障、SDK 超出缓冲容量等情况仍可能丢数据。

## 6. 代理 IP 与限流

默认 `TRUST_PROXY=false`，直接使用连接 IP。开启代理模式时，只有直接连接来源位于 `TRUSTED_PROXY_CIDRS` 才解析 XFF；从右向左跳过可信代理，非法链回落为连接 IP。

`TRUSTED_PROXY_CIDRS` 默认仅信任 `127.0.0.1/32,::1/128`。容器、负载均衡器与多层代理必须按实际拓扑配置，不能直接套用回环地址；不应将所有地址都设为可信。

边缘 Nginx 覆盖外来 XFF，官网与管理端登录（`/api/(v1/)?(admin/)?auth/`）和上报入口分别设置网关限流，超限返回 429。经该网关使用 `--simulate-ips` 不会保留伪造的访客 IP；多 IP 模拟仅用于隔离环境中显式信任的直连压测机。

实现入口：[IP 解析](../server/apps/monitor/utils.py)、[生产网关示例](../deploy/host-nginx.conf)、[环境变量示例](../server/.env.example)。

## 7. 发布与运行

### local 模式

裸仓库钩子固定使用本次推送的完整 SHA，每次发布都创建独立源码目录，包括重复发布同一提交。依赖按锁文件安装，五个模块检查后执行迁移，在备用端口启动候选 Gunicorn，再切换 Nginx 的前端根目录与 API upstream。

验收包括候选 `/api/ready`、两端网关 readiness 和 `/__release` 版本标记；确认切换成功后停止旧进程。失败尝试恢复旧配置，并验证实际回滚版本；若无法确认回滚，保留候选进程，避免网关仍引用它时被直接终止。旧哈希静态资源保留，旧页面可继续懒加载。

该模式使用持久 `DATABASE_URL`、`PORT` / `PORT+1` 两个候选端口，状态保存在部署目录 `run/`。它不自动管理独立 ingest worker 的版本切换，队列升级需单独操作。

### Docker 与 GitHub Actions

Compose 默认提供 PostgreSQL、server、web、admin，`ha` profile 增加单个 Redis 与 worker。`ha` 是服务组合名称，不代表已经具备跨机高可用。Docker 发布当前仍为单实例重建，没有与 local 相同的自动网关切换和回滚。

GitHub Actions 已配置五模块检查、PostgreSQL / Redis 契约与集成步骤、镜像发布及可选 SSH 部署。已验证记录是本地执行结果；本轮未核验远端流水线和生产部署状态。

详见[部署与容灾指南](CICD_AND_DISASTER_RECOVERY.md)。

## 8. 容量评估口径

- `rps`：所有已完成响应的速率，包含限流响应。
- `successRps`：成功且未限流的业务响应速率，是容量换算依据。
- `successLatencyMs`：成功响应的延迟分布，容量档位使用其中的 P95。
- HTTP SLA 默认最大限流拒绝率为 1%，零成功样本不能通过；容量分类中零成功或拒绝率超过 1% 判为 overloaded。
- CCU / DAU 根据成功 RPS 和请求间隔、日请求数等假设换算，不等于生产承载保证，也不等于异步事件落库吞吐。
- CPU、Load 与内存取自压测机；报告的 `hostSpec.measurementSource` 标为 `load-generator`。远程被测服务需要独立监测。

[历史压测报告](STRESS_TEST_REPORT.md) 保留旧环境与原始数值。第一批优化后尚未重新完成全栈容量压测，不能用旧的“全部 429 也算健康”的计算口径作上线承诺。

此外，`/api/v1/system/status` 提供后端单实例内存态实时流量滑窗（10 秒 RPS、1 分钟请求 / 5xx / 429 与 P95 延迟）、宿主机 `/proc` CPU / 内存 / Load 采样、压测心跳（`.active-run.json` 与 `X-Stress-Run` 请求头）以及瓶颈分级提示；其中的 `safeRpsBaseline` 仅为看板余量参考阈值，不替代正式容量压测。实现入口：[系统状态](../server/apps/monitor/services/system.py)、[瓶颈评估](../server/apps/monitor/services/bottleneck.py)、[后台状态卡片](../admin/src/features/system/components/StressBottleneckCard.tsx)。

## 9. 当前未完成能力

数据保留与定时清理、数据库侧聚合、自日志异步通道、SDK 请求超时、通知与购物车解耦、基础层测试治理仍未完成。接口契约已将定期清理和异步自日志标注为后续规划事项，具体优先级与验收要求见[开发进度](DEVELOPMENT_PROGRESS.md)。
