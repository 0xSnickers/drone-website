# 开发进度

更新日期：2026-11-25（Asia/Shanghai）。本记录基于本次架构评估及第一批优化的工作区代码与执行结果，不代表已合并或已部署到生产。

## 1. 当前阶段

第一批优化已完成代码与本地回归，覆盖权限隔离、队列确认与去重、代理信任链、容量口径、local 发布隔离和查询参数校验。当前工作区仍包含未提交改动与新增文件；本轮未执行生产发布，也未重跑完整容量压测。

当前方案见[CURRENT_SOLUTION.md](CURRENT_SOLUTION.md)，发布方式与升级条件见[部署与容灾指南](CICD_AND_DISASTER_RECOVERY.md)。

## 2. 已完成事项

### 2.1 官网会员与监控访问隔离

- 增加 `monitor_viewer` 角色；公开注册仍只创建 `user`。
- 前后台会话按 `aud`（`web` / `admin`）与独立 HttpOnly Cookie（`refresh_token` / `admin_refresh_token`）隔离，后台鉴权走 `/api/v1/admin/auth/*`，普通会员登录后台返回 `403 ADMIN_ACCESS_REQUIRED`。
- 监控查询要求 `aud=admin` 且角色为 `admin` / `monitor_viewer`，写操作与用户管理写接口只允许 `admin`。
- 后台关闭自助注册入口，官网个人页仅展示当前登录会员资料；后台 JWT 会话检视与用户管理界面正并行完善。
- 已覆盖未登录 401、普通会员 403、跨端 `aud` 隔离、双端独立登出、注册不能提升角色、只读角色不能写入等回归路径。
- 代码入口：[后端权限](../server/apps/auth/authentication.py)、[鉴权视图](../server/apps/auth/views.py)、[后台守卫](../admin/src/features/auth/components/RouteGuards.tsx)。
- 边界：当前只读角色可访问全部项目，多租户与项目成员授权未实现。

### 2.2 队列确认、任务恢复与批次去重

- Redis List 的先弹出再落库改为 Streams 消费组、事务提交后确认。
- 增加批次收据，防止同一批次因 ACK 丢失、并发重放或入队响应丢失重复落库。
- 满载返回 429，不裁剪已接收任务；Redis 配置为 `noeviction`。
- 支持旧 List 分批迁移；系统队列深度包含旧队列与新 Stream。
- 代码入口：[队列](../server/apps/monitor/services/queue.py)、[落库服务](../server/apps/monitor/services/ingest.py)、[worker](../server/apps/monitor/management/commands/run_ingest_worker.py)。
- 边界：降级采样仍然有损；HTTP 新批次重试不属于同一批次去重；非法任务暂留 pending，未建立自动死信处置。

### 2.3 代理 IP 信任链

- 增加 `TRUSTED_PROXY_CIDRS`，后端仅信任指定来源的代理头。
- 从右向左解析代理链，非法链回落为连接 IP；网关覆盖外来 XFF。
- 登录（含 `/auth/` 与 `/admin/auth/`，带 / 不带 `/v1`）和上报网关限流超限返回 429。
- 已覆盖伪造前缀、非可信直连、多层代理、IPv6 和非法头的回归。
- 代码入口：[IP 解析](../server/apps/monitor/utils.py)、[网关配置](../deploy/host-nginx.conf)。

### 2.4 容量指标与 SLA 修正

- 分开记录总 RPS、成功 RPS、拒绝率和成功响应延迟。
- 零成功、高拒绝率不能被判为健康容量；CCU / DAU 以成功业务吞吐换算。
- CPU / 内存来源明确为压测机，历史报告增加口径失效说明。
- 已增加全部返回 429 的回归用例；旧容量数值尚待复测。
- 代码入口：[负载统计](../stress-test/src/core/load-runner.ts)、[容量估算](../stress-test/src/core/capacity.ts)。

### 2.5 local 发布隔离与回滚

- 使用推送的准确 SHA，每次发布都创建新的源码目录，不覆盖在线目录。
- 依赖按锁文件安装，五模块检查后在备用端口启动候选服务。
- readiness 与版本标记通过后才确认网关切换；保留旧哈希资源。
- 回滚会检查实际旧版本，覆盖连续 Nginx reload 信号可能合并的竞态。
- 已用真实临时 Nginx / Gunicorn 验证切换、旧资源访问、失败回滚；另用临时 Git 裸仓库验证准确提交与重复发布隔离。
- 代码入口：[发布钩子](../deploy/post-receive.sh)、[local 发布脚本](../deploy/local-release.sh)。
- 边界：迁移要求向前兼容；Docker 单实例重建没有同等切换和回滚能力；local 发布不自动升级独立 ingest worker。

### 2.6 查询校验与 CI 补充

- 统一校验监控查询参数，非法 UUID、范围、分页与枚举返回 400。
- 新增隔离接口契约脚本，同步权限契约与两项迁移。
- CI 增加真实 Redis / PostgreSQL 集成步骤，并断言 worker 的业务数据确实落库。
- 代码入口：[查询校验](../server/apps/monitor/views/query_params.py)、[契约脚本](../server/scripts/check-contract.sh)、[CI 配置](../.github/workflows/ci-cd.yml)。
- CI 配置已更新，本轮未核验 GitHub 远端执行记录。

### 2.7 实时系统状态与压测瓶颈观测

- `/api/v1/system/status` 补充主机 CPU / 内存 / Load 非阻塞采样、进程内 10s / 60s 流量滑窗、压测运行心跳（`.active-run.json` 与 `X-Stress-Run`）及瓶颈分级评估。
- 修复 `system/status` 队列深度统计，同时汇总旧 List（`LLEN`）与新 Stream `:v2`（`XLEN`）积压。
- 后台首页接入实时瓶颈与压测状态卡片，补齐组件单测与后端回归用例。
- 代码入口：[系统状态](../server/apps/monitor/services/system.py)、[瓶颈评估](../server/apps/monitor/services/bottleneck.py)、[压测心跳](../stress-test/src/core/heartbeat.ts)、[状态卡片](../admin/src/features/system/components/StressBottleneckCard.tsx)。
- 边界：流量滑窗为单 worker 进程内存态，多进程或多机部署不跨实例汇总；`safeRpsBaseline` 为经验参考阈值而非容量承诺。

## 3. 已执行的验证

以下包含 2026-11-25 第一批优化验证与最新收口回归结果：

- `web/`：`npm run check` 通过，18 项测试；含 lint、类型检查与生产构建。
- `admin/`：`npm run lint`、`npm run typecheck` 与单测通过，30 项测试（覆盖路由权限、实时瓶颈卡片与用户面板）。
- `sdk/`：`npm run check` 通过，14 项测试；本批 SDK 实现未修改。
- `stress-test/`：`npm run check` 通过，13 项测试；包含全 429 容量反例。
- `server/`：本地默认环境（无外部 Redis）运行 ruff、格式检查与 pytest，74 项通过、7 项 Redis 集成用例按预期跳过（含新增的双队列深度合并单测与 `/api/admin/auth/` 网关转发验证）；早先配置临时 Redis 时队列集成用例亦已验证通过。
- PostgreSQL 16 + Redis 7（第一批验证）：队列集成测试 7 项全部通过，含 SQLite 跳过的并发收据用例。
- 接口契约：`./scripts/check-contract.sh` 临时 SQLite / Gunicorn 环境 25 项通过（早先独立 PostgreSQL 环境同样 25 项通过）。
- 发布集成：临时 Nginx / Gunicorn 的切换、`/api/admin/auth/` 路由重写与失败回滚通过；准确 SHA 与重复发布隔离通过。发布测试中的依赖安装与模块检查使用桩替代，模块本身另行执行了实际检查。
- 静态检查：`git diff --check`、相关脚本 `bash -n` 通过。

当前默认本地回归合计 149 项单测与集成测试通过（另含 7 项需外部 Redis / PostgreSQL 的队列集成测试及 25 项隔离契约测试）。主机未安装 uv 时使用现有 `.venv` 回退；本地前端构建保留 Vite 关于未来 native 配置加载器的兼容提示，不影响本次构建。

验证使用独立临时目录、端口及 PostgreSQL / Redis 容器，测试后已清理相关服务。未执行生产升级、大规模新容量压测、跨可用区故障切换或真实业务支付 / 预约闭环验证。

对应测试入口：

- [后端边界回归](../server/tests/monitor/test_boundaries.py)。
- [真实队列与并发事务](../server/tests/integration/test_queue.py)。
- [网关切换与回滚](../server/tests/integration/test_local_release.py)。
- [发布提交隔离](../server/tests/integration/test_release_hook.py)。
- [后台权限](../admin/src/features/auth/components/RouteGuards.test.tsx)。
- [限流与容量回归](../stress-test/tests/load-runner.test.ts)。

## 4. 下一批待办

以下均未完成，按依赖与风险排序；暂不承诺日期或工作量百分比。

### 4.1 数据保留与清理（P2）

契约描述了 `DATA_RETENTION_DAYS` 定时清理，但仓库尚无对应配置、命令与调度。需同时定义事件、异常明细、服务日志、批次收据及过期刷新凭证的生命周期。

验收：分批且可重跑的清理命令、明确调度入口、保留边界与关联记录测试、最近执行时间和清理数量。收据清理必须考虑仍可重放的 pending 任务，避免破坏幂等性。

### 4.2 统计聚合与容量复测（P2）

把计数、去重、分组、均值优先下推数据库，再按数据量决定是否增量聚合与缓存。用修正后的压测工具补充代表性数据量、成功吞吐、拒绝率、落库延迟和被测机资源记录。

验收：与现有统计口径一致，提供 SQL / 内存 / P95 基线；新容量报告记录数据规模、负载构成和运行拓扑，单独区分静态资源、上报接收与持久化吞吐。

### 4.3 SDK 超时与排空约定（P2）

浏览器与 Node 发送仍没有主动请求超时；`flush` / `close` 的单批、排空和退出总时限需要明确，卸载分批应按 UTF-8 字节计算。

验收：永不完成的请求、关闭时限、多批积压、大堆栈和丢弃计数的回归测试。

### 4.4 前端通知与业务组件解耦（P2）

将通知能力从购物车 store 拆出，解除学院、社区等对购物车模块的依赖；拆分学院、规格、商城等长组件。

验收：保留现有交互测试，各业务模块可独立渲染；购物车持久化与演示初始商品需先明确产品行为。

### 4.5 自日志实现与契约对齐（P2）

`SelfLogMiddleware` 仍在响应路径同步写库并吞掉写入异常；契约描述的应用级 warn/error 堆栈异步批量入库尚未完整实现。

验收：确定异步通道或收缩契约，验证请求 ID、应用堆栈、数据库故障与失败计数，避免监控阻塞业务。

### 4.6 基础层与工程约束治理（P3）

清理各端剩余模板文档、补充 core 测试与边界规则，分拆过长的查询服务，减少基础逻辑双端重复修复。是否提炼共享包，依据实际变更频率决定。

验收：文档入口一致，核心基础层进入检查范围，各端继续独立构建。当前集中整理文档只完成说明入口，不能替代这些代码治理工作。

### 4.7 后续运行能力

自动死信处置、收据 / 静态资源归档、worker 发布编排、Docker 持续可用切换和自动回滚仍需补充。项目级授权仅在多组织需求明确后设计。CDN、SLB、跨区数据库、ClickHouse 等属于扩容选项，没有作为本次优化成果交付。

## 5. 上线前置事项

1. 将完整改动（含新增脚本、测试、迁移）纳入版本管理并完成评审；不能只发布现有 tracked 文件。
2. 在目标环境验证配置和依赖，执行 `users/0002_alter_user_role`、`auth/0002_refreshtoken_audience`、`monitor/0003_ingestreceipt` 迁移；迁移需向前兼容，应用回滚不会撤销数据库变更。
3. 逐一确认后台账号角色；公开会员不能再用作只读监控账号。
4. 根据实际代理拓扑配置 `TRUSTED_PROXY_CIDRS`，容器代理来源通常不在默认回环网段中。
5. 启用异步队列时先停旧 List worker，再部署新代码、执行迁移并启动新 worker；确认 Redis AOF、`noeviction`、容量与可见性超时。
6. local 发布准备两个候选端口与持久 `DATABASE_URL`，验收两个前端、API 和独立 worker。Docker 模式按单实例重建预期安排发布窗口。
7. 验收后记录部署 SHA、环境、迁移状态与测试结果，再将本页状态更新为“已部署”。目前没有这份生产验收记录。

## 6. 进度更新约定

每批更新同时写明完成内容、代码入口、实测证据、未覆盖范围和下一步验收标准。历史测试数量只代表该次工作区快照，后续新增测试时应更新记录；历史压测数值单独保留，不能用开发回归结果替代容量证明。
