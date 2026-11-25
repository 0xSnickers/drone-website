# 数据流向步骤图与分步解析

本文档按业务运行时的真实调用顺序，使用 Mermaid 时序图（`sequenceDiagram`）、状态图（`stateDiagram-v2`）与判定流程图（`flowchart`）拆解系统中的 **5 条核心数据流**，并对每一步的数据形态、校验规则与异常兜底做详细说明。

---

## 1. 前后台双端鉴权、Audience 隔离与静默刷新流

官网（`web/`）与管理后台（`admin/`）共用后端 `users` 表，但通过 **JWT `aud` 声明 + 独立路由前缀 + 独立 HttpOnly Cookie** 实现会话物理隔离，防止官网会话越权调用监控端，也避免一端退出导致另一端掉线。

```mermaid
sequenceDiagram
    autonumber
    participant Web as "web/ 官网 (5173)"
    participant Admin as "admin/ 监控后台 (5174)"
    participant Nginx as "边缘 Nginx (认证限流)"
    participant Auth as "server/ apps.auth"
    participant Monitor as "server/ apps.monitor"
    participant DB as "PostgreSQL / SQLite"

    rect rgb(235, 245, 255)
        Note over Web,DB: 阶段 A：官网会员注册或登录 (aud = web)
        Web->>Nginx: POST /api/v1/auth/login { email, password }
        Nginx->>Auth: 校验 5r/s 限流后转发请求
        Auth->>DB: 查询 users 并校验 PBKDF2 密码哈希
        Auth->>DB: 写入 refresh_tokens (SHA-256 哈希, audience='web')
        Auth-->>Web: 200 { user, accessToken(aud='web') } + Set-Cookie: refresh_token
    end

    rect rgb(255, 243, 235)
        Note over Web,Monitor: 阶段 B：跨端越权阻断验证
        Web->>Monitor: 携带官网 Bearer Token(aud='web') 请求 GET /api/v1/projects
        Monitor->>Monitor: CanReadMonitor 校验 aud == 'admin' 失败
        Monitor-->>Web: 403 FORBIDDEN (即使账号角色为 admin 亦拒绝跨端令牌)
    end

    rect rgb(235, 252, 242)
        Note over Admin,DB: 阶段 C：管理端登录与 singleFlight 并发 401 静默续期 (aud = admin)
        Admin->>Nginx: POST /api/v1/admin/auth/login { email, password }
        Nginx->>Auth: 匹配 /api/(v1/)?(admin/)?auth/ 限流并转发
        Auth->>DB: 校验密码且确认 role 属于 {admin, monitor_viewer}
        Auth->>DB: 写入 refresh_tokens (SHA-256 哈希, audience='admin')
        Auth-->>Admin: 200 { user, accessToken(aud='admin') } + Set-Cookie: admin_refresh_token
        Note over Admin: 内存保存 accessToken, 15 分钟后过期, 页面并发发出多个监控请求
        Admin->>Monitor: 并发请求 /analytics/overview 与 /events (过期 Token)
        Monitor-->>Admin: 401 UNAUTHORIZED
        Admin->>Auth: singleFlight 合并为单次 POST /api/v1/admin/auth/refresh (自动带 admin_refresh_token)
        Auth->>DB: 按 token_hash + audience='admin' + 未过期查验并重查用户角色
        Auth-->>Admin: 200 返回新 accessToken(aud='admin', 不轮换原 Cookie)
        Admin->>Monitor: 自动重放刚才挂起的并发请求并返回 200 数据
    end
```

### 分步说明
1. **网关入口防爆破**：官网 `/api/v1/auth/*` 与后台 `/api/v1/admin/auth/*`（含省略 `/v1` 的同源代理路径）均命中 Nginx `5r/s + burst 10` 速率限制，超限直接返回 `429`。
2. **双 Cookie 独立生命周期**：数据库 `refresh_tokens` 表仅保存随机串的 SHA-256 摘要及 `audience`（`web` 或 `admin`）；官网登出只删除 `refresh_token` 及其 `web` 记录，后台会话保持在线。
3. **管理端准入门槛**：普通官网会员（`role=user`）尝试调用 `/api/v1/admin/auth/login` 时，后端在签发 Cookie 前直接返回 `403 ADMIN_ACCESS_REQUIRED`。
4. **内存令牌与并发刷新合并**：两端前端均将 `accessToken` 仅保存在 JS 内存中（防 XSS 持久化窃取）；刷新页面或遇到并发 `401` 时，经 `singleFlight` 锁确保同一时刻只发出一笔 `/refresh` 请求。

---

## 2. 遥测上报、Redis Streams 削峰与 Worker 幂等落库流

这是监控系统的核心写入链路，支持 `direct`（同步直写）与 `redis_queue`（Redis 7 Streams 消费组异步缓冲 + 故障自动熔断降级）两种运行模式。

```mermaid
sequenceDiagram
    autonumber
    participant App as "Web / Admin 浏览器"
    participant SDK as "sdk/ (monitor-sdk)"
    participant Nginx as "Nginx 网关"
    participant Ingest as "server/ IngestView & ingest.py"
    participant Redis as "Redis 7 (限流 + Stream :v2)"
    participant Worker as "run_ingest_worker 消费进程"
    participant DB as "PostgreSQL 16"

    App->>SDK: 触发路由切换 / data-track 点击 / JS 或接口报错 / Web Vitals
    SDK->>SDK: 注入 visitorId + sessionId + 最近 20 条 Breadcrumbs
    SDK->>SDK: 攒满 10 条或满 5s (页面关闭走 sendBeacon)
    SDK->>Nginx: POST /api/v1/ingest/events (text/plain JSON, 避免 CORS 预检)
    Nginx->>Ingest: 覆写 X-Forwarded-For 为真实连接 IP, 20r/s 网关限流后转发

    Ingest->>Ingest: extract_client_ip (仅 TRUST_PROXY 且连接来自 TRUSTED_PROXY_CIDRS 才从右向左剥离代理)
    Ingest->>Redis: 1. 单 IP 速率限制 (INCR monitor:rl:ip:minute <= 600, 超限返回 429)
    Ingest->>DB: 2. 校验 appKey 查 Project (无效返回 401) -> 3. 查 IpRule 黑名单 (命中返回 403)
    Ingest->>Ingest: 4. Serializer 校验批次结构 + 字符串截断 + 超 4KB JSON 替换为 {_truncated: true}
    Ingest->>Ingest: 5. 生成批次唯一 UUID (job_id)

    alt INGEST_MODE = redis_queue 且熔断器关闭
        Ingest->>Redis: 6. Lua 脚本检查 XLEN < INGEST_QUEUE_MAXLEN 后 XADD 写入 :v2 Stream
        alt Stream 已满 (>= 50000)
            Redis-->>Ingest: 返回 false (绝不裁剪已入队旧数据)
            Ingest-->>SDK: 429 RATE_LIMITED (SDK 保留批次退避重试)
        else 入队成功
            Redis-->>Ingest: 返回 Stream Entry ID
            Ingest-->>SDK: 200 { code: 0, data: { accepted: N } }
        end

        loop 后台常驻消费循环
            Worker->>Redis: 7. Lua 原子迁移遗留旧 List -> XAUTOCLAIM 超时重领 -> XREADGROUP 领取新消息
            Worker->>DB: 8. 开启 database transaction.atomic()
            Worker->>DB: 查询或插入 ingest_receipts(job_id) 校验批次幂等
            Worker->>DB: 批量写入 events / 指纹归并更新 error_issues(resolved 自动重开为 open) + error_events
            Worker->>DB: 提交数据库事务
            Worker->>Redis: 9. 事务提交成功后执行 Lua XACK + XDEL 确认并移除消息
        end
    else INGEST_MODE = direct 或 Redis 超时 (>200ms) 触发 30s 熔断降级
        Ingest->>Ingest: 熔断降级时: error 事件 100% 保留, 其余行为按 INGEST_FALLBACK_SAMPLE_RATE(0.2) 采样
        Ingest->>DB: 单事务直接写入业务表 + ingest_receipts(job_id)
        Ingest-->>SDK: 200 { code: 0, data: { accepted: 实际保留条数 } }
    end
```

### 队列状态与故障降级决策图

```mermaid
flowchart TD
    Req["收到合法上报批次 (已通过限流 / appKey / 黑名单 / 字段校验)"] --> ModeCheck{"INGEST_MODE == redis_queue 且配置了 REDIS_URL?"}
    ModeCheck -->|"否 (默认 direct)"| DirectWrite["同步单事务写 DB + ingest_receipts"]
    ModeCheck -->|"是"| CircuitCheck{"进程内熔断器是否处于开启期 (30s)?"}

    CircuitCheck -->|"是 (熔断保护中)"| Sample["有损降级保护: 异常 100% 保留, 行为事件按 20% 采样, 日志全量直写"]
    Sample --> DirectWrite

    CircuitCheck -->|"否"| LuaEnqueue["执行 Redis Lua: 检查 XLEN(:v2) < 50000 并 XADD"]
    LuaEnqueue -->|"200ms 内连接失败或超时"| Trip["打开当前进程 30s 熔断器 + 限流回退本地内存窗口"]
    Trip --> Sample
    LuaEnqueue -->|"队列已满返回 false"| Reject429["返回 HTTP 429 RATE_LIMITED (保护已接收数据不丢失)"]
    LuaEnqueue -->|"入队成功"| Return200["立即返回 HTTP 200 accepted"]
```

### 关键步骤解析
- **严格校验顺序（省资源优先）**：先做内存/Redis 级 IP 限流（429）→ 再查 `appKey`（401）→ 再查 IP 黑名单（403）→ 最后做重度 JSON 字段序列化校验（400）。
- **异常指纹归并逻辑**：对 `type=error` 事件，后端提取「错误子类型 + 剔除数字/UUID/引号/URL 后的归一化消息 + 剔除行列号的堆栈首帧」计算哈希指纹；同一项目下相同指纹合并计数，若原状态为 `resolved` 则自动重新激活为 `open`（`ignored` 保持静默）。
- **至少一次投递 + 批次幂等**：Worker 崩溃或 ACK 网络丢失时，消息保留在 Stream PEL 中，超过 `INGEST_VISIBILITY_TIMEOUT_MS`（默认 60s）后被 `XAUTOCLAIM` 重新领取；重放时因 `ingest_receipts` 主键已存在而安全跳过，不会重复插入明细行。

---

## 3. 监控后台全局筛选、时区对齐聚合查询与异常处置流

```mermaid
sequenceDiagram
    autonumber
    participant User as "监控员 / 管理员"
    participant Filter as "admin/ Zustand 全局筛选器"
    participant TQuery as "admin/ TanStack Query"
    participant API as "server/ monitor.views"
    participant Svc as "server/ analytics & queries"
    participant DB as "PostgreSQL / SQLite"

    User->>Filter: 切换项目 (projectId) 或时间范围 (1h / 24h / 7d / 30d)
    Filter->>Filter: 持久化筛选条件并读取浏览器时区 (如 Asia/Shanghai)
    Filter->>TQuery: Query Key 变更触发重新请求 (保留上一帧 placeholderData 半透明展示)
    TQuery->>API: GET /api/v1/analytics/overview & /trend?projectId=...&range=24h&tz=Asia/Shanghai
    API->>API: BearerAuthentication + CanReadMonitor (校验 aud='admin' 与监控角色)
    API->>API: MonitorQuerySerializer 校验 UUID / range / 分页 / 枚举 (非法立即返回 400)
    API->>Svc: 构造 TimeWindow (计算当前周期、上一环比等长周期、时区对齐桶起点)
    Svc->>DB: 按服务端接收时间 created_at 范围索引拉取事件、异常与日志记录
    Svc->>Svc: 计算 PV/UV/会话/错误影响人数/P95 慢接口, 并对空时间桶补 0
    Svc-->>API: 返回连续时间序列与环比结构
    API-->>TQuery: 200 { code: 0, data: ... }
    TQuery-->>User: 无依赖 SVG 折线图、排行条与环比卡片平滑更新
```

### 前端异常问题（Issue）生命周期状态图

```mermaid
stateDiagram-v2
    [*] --> open: 首次上报新指纹异常 (创建 ErrorIssue, count = 1)
    open --> open: 同指纹异常再次上报 (count + 1, 更新 last_seen)
    open --> resolved: 管理员在后台点击「标记已解决」 (PUT /errors/issues/:id)
    open --> ignored: 管理员在后台点击「忽略」 (PUT /errors/issues/:id)
    resolved --> open: 新版本或线上再次捕获同指纹异常 (自动回归重开!)
    ignored --> ignored: 同指纹异常继续上报 (仅累加记录, 保持忽略不告警)
    resolved --> ignored: 管理员手动调整状态
    ignored --> open: 管理员手动取消忽略
```

---

## 4. 实时流量滑窗、压测心跳感知与系统瓶颈评估流

为了让管理员在跑压测或遭遇流量洪峰时无需登录宿主机即可直观看到水位，系统构建了一条轻量级的内存态实时观测链路：

```mermaid
sequenceDiagram
    autonumber
    participant Stress as "stress-test/ 压测进程"
    participant File as "reports/.active-run.json"
    participant MW as "server/ SelfLogMiddleware"
    participant Win as "system.py 内存滑窗 (10s/60s)"
    participant SysAPI as "GET /api/v1/system/status"
    participant Host as "Linux /proc & Redis & DB"
    participant Dash as "admin/ StressBottleneckCard"

    Stress->>File: 启动场景后每 2s 刷新 { active: true, profile, currentScenario, concurrency, updatedAtMs }
    Stress->>MW: 发起压测请求 (携带 User-Agent: AeroApex-StressTest 或 X-Stress-Run: 1)
    MW->>Win: 每次响应耗时与状态码写入线程安全双端队列 (排除 /system/status 自身请求)

    loop 后台概览页定时轮询
        Dash->>SysAPI: GET /api/v1/system/status
        SysAPI->>Host: 1. 数据库 SELECT 1 测延迟
        SysAPI->>Host: 2. Redis PING + LLEN(旧队列) + XLEN(:v2 Stream) 合并队列积压深度
        SysAPI->>Host: 3. 非阻塞读取 /proc/stat CPU 时间片差值、os.getloadavg() 与 /proc/meminfo
        SysAPI->>Win: 4. 聚合近 10s 实时 RPS、压测流量活跃标记与近 1m 请求数 / P95 / 5xx / 429
        SysAPI->>File: 5. 读取 20s 内新鲜压测心跳及最近一份 latest.json 报告摘要
        SysAPI->>SysAPI: 6. evaluate_bottleneck() 综合判定健康等级与首要瓶颈因子
        SysAPI-->>Dash: 返回 { database, redis, protection, host, traffic, bottleneck, stressTest }
        Dash-->>Dash: 渲染实时压测徽章、CPU/内存/容量余量进度条与瓶颈告警提示
    end
```

### 瓶颈等级（`evaluate_bottleneck`）判定优先级流程

```mermaid
flowchart TD
    Start["输入 DB 状态 / 队列积压 / 主机 CPU·Load·内存 / 实时 RPS·P95·5xx"] --> C1{"DB 不可达 或 (SQLite 且 5xx > 0)?"}
    C1 -->|"是"| CritDB["critical / database_lock"]
    C1 -->|"否"| C2{"近 1 分钟 5xx >= 5?"}
    C2 -->|"是"| Crit5xx["critical / server_errors"]
    C2 -->|"否"| C3{"CPU >= 85% 或 LoadRatio >= 1.0?"}
    C3 -->|"是"| CritCPU["critical / cpu"]
    C3 -->|"否"| C4{"内存 >= 90% 或 P95 >= 1000ms 或 队列积压 >= 10000?"}
    C4 -->|"是"| CritOther["critical / memory | latency | queue_backlog"]
    C4 -->|"否"| W1{"CPU >= 68% 或 LoadRatio >= 0.75 或 内存 >= 80%?"}
    W1 -->|"是"| WarnRes["approaching / cpu | memory"]
    W1 -->|"否"| W2{"(SQLite 且 RPS >= 15) 或 P95 >= 400ms 或 DB 延迟 >= 50ms 或 积压 >= 1000 或 容量比 >= 75%?"}
    W2 -->|"是"| WarnPerf["approaching / sqlite_concurrency | latency | queue_backlog | throughput"]
    W2 -->|"否"| Healthy["healthy / none (系统余量充足)"]
```

---

## 5. 全栈压力测试执行与容量阶梯探顶数据流

```mermaid
sequenceDiagram
    autonumber
    participant Dev as "开发者 / CI"
    participant CLI as "stress-test CLI"
    participant Target as "被测环境 (Web + Admin + Server)"
    participant Cap as "capacity.ts 容量评估器"
    participant Out as "reports/ (HTML / MD / JSON)"

    Dev->>CLI: 执行 npm run stress:capacity (或指定 --profile / --suite)
    CLI->>Target: 步骤 1：Preflight 门禁依次探活 Web、Admin、/api/health、/api/ready 与管理员登录获取 Token
    Target-->>CLI: 全部返回预期状态 (若任一失败立即终止并输出排障命令)

    loop 步骤 2：按并发阶梯或场景矩阵执行负载
        CLI->>Target: 并发注入 HTTP 流量 (静态资源 / SDK 双格式上报 / API 聚合查询 / 混合流量)
        CLI->>Target: 启动 Playwright 或原生 CDP 无头浏览器采集 FCP / LCP / Heap / 交互耗时
        Target-->>CLI: 返回业务响应 (2xx) / 限流响应 (429) / 异常响应 (5xx)
        CLI->>CLI: 分离统计总吞吐 rps 与有效业务吞吐 successRps、有效延迟 successLatencyMs
    end

    CLI->>Cap: 步骤 3：逐档位执行 SLA 与过载判定
    Note over Cap: 零成功样本 或 429 拒绝率 > 1% 或 5xx 超标 -> 判为 overloaded
    Cap->>Cap: 基于最高健康档位的 successRps 估算参考 CCU 与 DAU (标注压测机资源来源 load-generator)
    Cap->>Out: 步骤 4：生成内联 SVG 曲线的 latest.html、latest.md 与结构化 latest.json
```

### 容量数据流关键口径约束
1. **拒绝率隔离**：`429 RATE_LIMITED` 属于网关或应用的预期限流保护，不混入服务端崩溃错误率，但默认限流拒绝率超过 `1%` 或成功样本数为 `0` 时，该档位直接判定为 `overloaded`（不通过 SLA），杜绝“靠高速返回 429 刷出虚假高 QPS”。
2. **有效吞吐换算**：所有容量拐点 P95 与参考在线人数（CCU / DAU）一律仅由未限流的成功业务响应速率 `successRps` 计算得出。
