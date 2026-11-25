# 部署、容量演进与容灾指南

更新日期：2026-11-25（Asia/Shanghai）。本文说明当前仓库实现、部署条件与后续规划；本轮优化尚未发布到生产，不能据此推断现有服务器已经采用下述配置。

总体设计见[当前方案](CURRENT_SOLUTION.md)，完成状态与验证证据见[开发进度](DEVELOPMENT_PROGRESS.md)，旧压测数值见[历史压测报告](STRESS_TEST_REPORT.md)。

## 1. 文件与能力入口

- [Git 发布钩子](../deploy/post-receive.sh)：监听 main 推送、串行发布、固定本次 SHA，按 local / Docker 分支执行。
- [local 发布脚本](../deploy/local-release.sh)：独立源码目录、锁文件安装、五模块检查、候选端口、Nginx 切换与失败回滚。
- [生产 Compose](../docker-compose.prod.yml)：PostgreSQL、server、web、admin；可选 Redis 与 worker。
- [生产环境示例](../deploy/.env.prod.example)：数据库、鉴权、可信代理、队列与构建参数，部署前必须替换示例值。
- [宿主机 Nginx 示例](../deploy/host-nginx.conf)：域名代理、覆盖外来 XFF、认证 / 上报限流。
- [SPA 容器 Nginx](../deploy/spa-nginx.conf)：静态资源缓存、SPA 路由回退与静态站探针。
- [server 容器入口](../server/scripts/entrypoint.sh)：web / migrate / worker 三种角色。
- [队列实现](../server/apps/monitor/services/queue.py)：Streams 消费组、背压、旧 List 迁移。
- [限流与熔断](../server/apps/monitor/services/resilience.py)：RESP2 客户端、本地与 Redis 限流、采样降级。
- [备份脚本](../deploy/backup-postgres.sh)：PostgreSQL 导出、压缩加密、可选异地复制与恢复入口。
- [GitHub Actions](../.github/workflows/ci-cd.yml)：五模块检查、数据库与队列集成任务、镜像发布、可选 SSH 部署。

## 2. 两种发布方式

### 2.1 local：独立版本目录与网关切换

设置 `DEPLOY_MODE=local` 后，post-receive 使用收到的完整提交 SHA，将源码归档至 `sources/<SHA>/release-<发布 ID>`。即使重复发布同一提交，也创建新目录，避免重新安装依赖或构建时改动在线目录。

发布顺序：

1. 使用部署锁串行执行，以本次 SHA 创建独立源码目录。
2. 在目录内执行 `uv sync --frozen`，对 sdk、web、admin、stress-test 执行 `npm ci`，完成五模块检查。
3. 执行数据库迁移，在备用端口启动候选 Gunicorn；原服务保持运行。
4. 候选 `/api/ready` 通过后，复制新的哈希资源到共享资产目录并生成候选 Nginx 配置。
5. `nginx -t` 通过后重新加载网关，切换两个前端根目录及 API upstream。
6. 验证两个网关的 readiness 与 `/__release` 版本标记，记录 active 状态，再优雅终止旧 Gunicorn。

失败处理：

- 检查、迁移、候选启动或候选 readiness 失败时，不进入网关切换。
- 已切换后的验收失败，恢复旧配置并核对网关实际返回的旧版本；连续 reload 可能合并信号，不能只根据命令退出码判断回滚成功。
- 无法确认回滚时保留候选进程并返回失败，需检查网关与进程状态；脚本不在网关可能仍引用候选进程时直接终止它。
- 回滚应用不会撤销数据库迁移，迁移必须兼容仍在运行的旧版本。

运行条件：

- 主机需具备 uv、Node/npm、Nginx、curl、Git 和 flock；Node 版本依据根目录 `.nvmrc`。
- 必须提供显式、持久的 `DATABASE_URL`。生产示例中的 `postgres` 容器服务名适用于 Compose 网络，local 模式需改为宿主机可访问的数据库地址。
- 预留 `PORT` 与 `PORT+1` 两个 API 候选端口，以及 `WEB_HOST_PORT`、`ADMIN_HOST_PORT` 两个网关端口。脚本未配置时默认基准 API 端口为 19100；示例环境文件中的 `PORT` 会覆盖默认值。
- Nginx 配置与状态位于部署目录 `run/`；初次部署前避免端口与系统 Nginx 冲突。
- `run/active-port`、`run/active-source`、`run/active-revision` 记录当前版本，`nginx.previous.conf` 保留上一配置。
- 旧哈希资源保存在 `assets/web`、`assets/admin`，源码与静态资源暂不自动清理。

local 发布脚本不启动或切换独立 ingest worker，worker 升级由运维进程管理器单独安排。应用版本目录隔离不等于跨机器高可用。

### 2.2 Docker：单机编排与容器重建

默认 `DEPLOY_MODE=docker`。钩子在固定工作区检出准确 SHA，在临时容器中完成五模块检查，构建生产镜像、独立迁移，然后执行 Compose 更新并检查后端 `/api/ready`。

当前 Compose 单实例重建不提供 local 的双端口网关切换，也没有失败后自动恢复旧版本的完整流程。前端容器重建后，旧哈希资源保留策略也不同于 local 模式。需要持续可用发布时，应另行实现两组服务与网关切流，不能将当前 `compose up -d` 视为已完成滚动发布。

Compose 的 `ha` profile 只增加一个 Redis 与一个 worker，仍是单机服务组合；它不包含跨可用区 Redis、数据库副本、SLB 或自动故障切换。

### 2.3 GitHub Actions：配置存在，远端状态待验收

仓库已配置 sdk、web、admin、server、stress-test 检查，之后执行 PostgreSQL 16 / Redis 7 契约和集成任务；main 推送可继续发布 GHCR 镜像，并在配置 SSH Secrets 时执行远端部署。

当前 SSH 步骤从远端 main 更新源码后在服务器构建 Compose，并非按已发布的镜像摘要切换，也不调用 local 发布脚本。本轮只核验配置与本地测试，没有触发或确认远端流水线。启用前需验收环境文件、目标版本一致性、发布失败处理及回滚流程。

## 3. 容量演进：按测量结果升级

保留 L1～L4 的阶段名称作为规划与压测预设的组织方式。预设中的 DAU / QPS 标签是场景假设，不是当前代码或某台硬件的容量保证；不按固定 DAU 数字自动决定是否集群化。

### L1：单机基线

使用 PostgreSQL、应用服务与静态站托管，建立备份和资源监测。先验证业务成功率、拒绝率、查询 P95、数据库连接与磁盘增长，再评估单机余量。SQLite 可用于开发和部分回归，不能用其测试结果替代 PostgreSQL 并发写入验证。

### L2：卸载静态与数据库压力

当测量显示带宽、静态资源或数据库争用成为瓶颈时，再引入 CDN、独立数据库或调整进程数。CDN 缓存、失效和源站故障兜底需要单独部署与验收。

### L3：异步削峰与多实例

当同步写入影响接口延迟，且 worker 落库能力能够覆盖持续事件量时，启用 Redis Streams 与独立 worker。多应用实例还需负载均衡、可信代理、数据库连接预算和共享限流。队列只能吸收短时差额，不能替代持续写入能力。

### L4：分析存储与跨区能力

只有在明细规模、分析查询或恢复目标要求明确后，再评估分区、增量聚合、分析数据库、跨区副本和弹性编排。ClickHouse、Kafka、Kubernetes、托管高可用 RDS 等尚未作为当前仓库的已部署能力交付。

容量验证必须分开记录总 RPS、成功 RPS、429 拒绝率、异步落库吞吐与延迟；CPU / 内存需注明来自压测机还是被测服务。当前工具的成功吞吐与拒绝率门禁见[当前方案](CURRENT_SOLUTION.md)。

## 4. 故障处理边界

### 应用或容器故障

Compose 配置了 `restart: unless-stopped`，Nginx upstream 提供被动故障处理配置。单个服务实例退出时仍可能出现访问中断；当前没有完成跨机切换演练，不能承诺固定 RTO 或会话零中断。

### Redis 故障或队列满载

Redis 操作超时或失败时，当前应用进程熔断 30 秒，限流回落本地内存。异步事件接收保留原有有损采样直写策略；异常全量尝试写入，其他事件按配置采样，日志直写数据库。

队列达到配置容量时返回 429，不删除已接收任务。Redis 应使用 `noeviction`；AOF 与基础设施决定已接收任务的持久性。本地降级限流不是多进程、跨机器的统一限额。

### 数据库故障

`/api/ready` 执行数据库 `SELECT 1`，不可达返回 503 `NOT_READY`；它不检查 Redis，以免队列抖动直接影响数据库就绪判断。其他业务接口的数据库异常不能一概当作 503，未处理错误可能返回 500。

worker 领取后的任务在提交前保留，提交与收据为同一事务；超时重领后按收据去重。接收入口仍需查项目与黑名单，因此 Redis 正常也不代表数据库完全故障时可以持续接收所有上报。客户端缓冲与重试有容量和时间限制。

### 整机或区域故障

当前仓库提供部署和备份脚本，尚未交付跨区流量调度、数据库自动升主或已验证的 CDN 离线服务。RTO / RPO 需要依据真实备份频率、恢复演练、DNS / 网关切换和数据副本策略测量；本文不列未经演练的秒级或零损失承诺。

## 5. 第一批优化的升级要求

1. 发布完整版本，包含新增脚本和迁移，不只复制既有文件的 diff。
2. 备份目标数据库，执行 `users/0002_alter_user_role`、`auth/0002_refreshtoken_audience` 与 `monitor/0003_ingestreceipt`；确认管理员和只读监控账号角色。
3. 按实际网络配置 `TRUSTED_PROXY_CIDRS`。默认仅信任回环；容器、负载均衡器通常需要不同配置。边缘网关应覆盖外来 XFF。
4. 升级队列时先停止旧 List worker，再部署新代码、执行迁移并启动新 worker。新消费者分批迁移旧队列；混跑旧 worker 会继续存在旧消费方式的风险。
5. 设置 `INGEST_VISIBILITY_TIMEOUT_MS` 高于最长单批事务耗时，检查 Redis 空间、AOF、`noeviction` 与积压深度。
6. 根据 local / Docker 的不同能力安排发布和回滚；验收两端页面、角色限制、API、上报入队与实际落库。

验收完成后记录版本、迁移、配置和环境，再更新[开发进度](DEVELOPMENT_PROGRESS.md)中的部署状态。当前没有本轮生产发布记录。

## 6. 运维操作入口

以下命令用于准备或操作目标环境，本文档整理没有执行它们。

### 6.1 安装 Git 发布钩子

从项目根目录准备部署目录、私有环境文件与 Git 裸仓库，再将 `deploy/post-receive.sh` 安装到裸仓库的 `hooks/post-receive` 并赋予执行权限。

默认部署根目录位于裸仓库旁，也可通过 `DRONE_DEPLOY_BASE` 显式指定；生产配置位于该目录 `.env.prod`。选择 local 时设置 `DEPLOY_MODE=local`，并按 2.1 节提供宿主机数据库地址与工具链。选择 Docker 时使用宿主机网关配置与容器服务网络。

### 6.2 Compose 迁移与启动

在已审查的目标项目目录中，显式传入环境文件；`--env-file` 供 Compose 插值，`PROD_ENV_FILE` 指定服务的运行时环境文件：

```bash
export PROD_ENV_FILE=/srv/drone-website/.env.prod

docker compose --env-file "$PROD_ENV_FILE" -f docker-compose.prod.yml build
docker compose --env-file "$PROD_ENV_FILE" -f docker-compose.prod.yml up -d postgres
docker compose --env-file "$PROD_ENV_FILE" -f docker-compose.prod.yml run --rm server migrate
docker compose --env-file "$PROD_ENV_FILE" -f docker-compose.prod.yml up -d
```

启用异步队列时，先在环境文件中配置 `REDIS_URL=redis://redis:6379/0`、`INGEST_MODE=redis_queue`；按第 5 节完成旧 worker 升级步骤，并在 Compose 命令中启用 `--profile ha`。裸仓库 Docker 钩子还需设置 `ENABLE_HA_PROFILE=true`。local 模式需要独立可访问的 Redis 地址与独立 worker 进程管理。

这些步骤仍然是单实例更新，未提供 Docker 自动回滚。

### 6.3 备份与恢复

`deploy/backup-postgres.sh` 从 Compose 的 PostgreSQL 导出 SQL，压缩后用 OpenSSL 加密，校验可解密且内容非空，再可选用 rclone 复制到异地。默认清理超过 14 天的本地备份；这不等于清理业务明细表。

调用前由受控环境注入 `BACKUP_PASSPHRASE`，并提供与目标一致的数据库用户、数据库名、Compose 文件和备份目录。调度任务应设置正确工作目录；脚本文件存在不代表已经配置定时或异地备份。

```bash
cd /srv/drone-website/work
./deploy/backup-postgres.sh

# 在已确认的恢复目标或隔离演练环境中执行
./deploy/backup-postgres.sh --restore /srv/drone-website/backups/pg_backup.sql.gz.enc
```

恢复入口会执行备份中的清理与建表语句，需确认目标。解密与非空校验仅验证文件基本可读，恢复耗时、数据完整性与业务可用性需要定期隔离恢复演练；本轮未执行该演练。

## 7. 验证与未完成项

已执行的本地验证包括准确 SHA 与重复发布隔离、真实临时 Nginx / Gunicorn 的切换和失败回滚、PostgreSQL / Redis 的队列恢复与并发收据测试。完整命令与结果见[开发进度](DEVELOPMENT_PROGRESS.md)。

仍待完成：数据保留与收据清理、死信处置、worker 版本编排、发布目录与旧静态资源归档、Docker 持续可用切换、远端 CI/CD 验收、异地恢复演练，以及修正容量口径后的完整复测。
