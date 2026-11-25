# 项目架构流程图与各子项目详解

本文档通过 Mermaid 架构流程图详细拆解 `drone-website` 的全栈拓扑结构，并逐一说明 `web/`、`admin/`、`sdk/`、`server/`、`stress-test/` 与 `deploy/` 六个组成部分的内部模块划分、关键实现入口及技术边界。

---

## 1. 全栈总体架构拓扑图

项目采用 **两个独立 React SPA + 一个共享零依赖 SDK + 一个 Django 模块化单体 + 一个独立全链路压测引擎** 的单体仓库（Monorepo 风格目录）结构，前后端与异步消费进程职责清晰，暂不拆分微服务。

```mermaid
flowchart TB
    subgraph Clients["客户端与压测发起端"]
        Visitor["官网访客 / 会员浏览器"]
        Operator["管理员 / 只读监控员浏览器"]
        StressCLI["stress-test/ 独立全栈压测 CLI"]
    end

    subgraph Edge["边缘反向代理与静态托管层 (deploy/)"]
        Nginx["Nginx 网关 (XFF 覆写 / 登录与上报限流 / 静态缓存)"]
        WebSPA["web/ 无人机展示官网 SPA (Dev 5173)"]
        AdminSPA["admin/ 监控与管理后台 SPA (Dev 5174)"]
    end

    subgraph SharedSDK["共享遥测层 (sdk/)"]
        BrowserSDK["monitor-sdk 浏览器采集内核 (PV / 埋点 / 异常 / 性能)"]
        NodeSDK["monitor-sdk/node 服务端日志推送器"]
    end

    subgraph Backend["统一后端服务层 (server/ Django 5.2 + DRF, Port 9000)"]
        Middleware["中间件链 (RequestId -> CORS -> SelfLog 流量滑窗)"]
        CoreApp["apps/core (统一响应 envelope / 国际化错误码 / 探针)"]
        AuthApp["apps/auth (双端 aud JWT + 独立 HttpOnly Cookie)"]
        UsersApp["apps/users (user / monitor_viewer / admin 角色管理)"]
        MonitorAPI["apps/monitor 视图与服务 (接收 / 统计 / 明细 / 系统瓶颈)"]
        IngestWorker["run_ingest_worker 独立异步消费进程"]
    end

    subgraph Storage["数据存储与缓冲层"]
        Redis["Redis 7 (分布式限流 + Streams :v2 消费组队列)"]
        DB["PostgreSQL 16 (生产) / SQLite (本地开发回退)"]
        HeartbeatFile["stress-test/reports/.active-run.json (压测实时心跳)"]
    end

    Visitor -->|"HTTPS / HTTP"| Nginx
    Operator -->|"HTTPS / HTTP"| Nginx
    StressCLI -->|"HTTP 高并发 / 无头浏览器 / X-Stress-Run"| Nginx
    StressCLI -.->|"写入运行态心跳与最新报告"| HeartbeatFile

    Nginx -->|"静态资源与 SPA 路由"| WebSPA
    Nginx -->|"静态资源与 SPA 路由"| AdminSPA
    WebSPA -.->|"源码别名引用"| BrowserSDK
    AdminSPA -.->|"自监控按需加载"| BrowserSDK
    BrowserSDK -->|"POST /api/v1/ingest/events (JSON 或 sendBeacon)"| Nginx
    NodeSDK -.->|"POST /api/v1/ingest/logs"| Nginx

    Nginx -->|"反向代理 /api/*"| Middleware
    Middleware --> CoreApp
    Middleware --> AuthApp
    Middleware --> UsersApp
    Middleware --> MonitorAPI

    AuthApp --> DB
    UsersApp --> DB
    MonitorAPI -->|"direct 模式直写 / 聚合与明细查询"| DB
    MonitorAPI -->|"redis_queue 模式限流与 XADD 入队"| Redis
    MonitorAPI -.->|"读取压测心跳与最新摘要"| HeartbeatFile
    IngestWorker -->|"XAUTOCLAIM / XREADGROUP 领取 + XACK 确认"| Redis
    IngestWorker -->|"单事务写入业务表 + ingest_receipts 去重收据"| DB
```

---

## 2. 各子项目内部架构与职责详解

### 2.1 `web/` —— AeroApex 无人机展示官网（端口 `5173`）

`web/` 是面向终端访客与注册会员的品牌展示和体验前端，基于 React 19、Vite 8、Tailwind CSS v4、TanStack Query 5 与 Zustand 5 构建。

```mermaid
flowchart LR
    subgraph Entry["应用启动与外壳 (src/app & layout)"]
        Boot["bootstrap.ts (注入鉴权拦截器 / 初始化遥测 / 恢复会话)"]
        Providers["AppProviders (主题偏好 -> ErrorBoundary -> QueryClient)"]
        Router["router.tsx (公开页 / GuestOnly / RequireAuth 懒加载)"]
        Layout["MainLayout + RouteTracker (导航栏 / 购物车抽屉 / 路由 PV)"]
    end

    subgraph Pages["路由页面层 (src/pages - 仅做组合)"]
        HomeP["HomePage (首页全屏视觉与核心卖点)"]
        FlagshipP["FlagshipPage (旗舰机型参数对比与预约)"]
        AcademyP["AcademyPage (飞行学院课程与 SN 校验)"]
        CommunityP["CommunityPage (航拍社区作品瀑布流与互动)"]
        StoreP["StorePage (官方商城配件选购与模拟结算)"]
        AuthP["LoginPage / RegisterPage / ProfilePage"]
    end

    subgraph Features["领域功能模块 (src/features/* 经 index.ts 暴露)"]
        FShowcase["showcase / flagship (机型规格与对比交互)"]
        FAcademy["academy (课程目录与设备序列号校验)"]
        FCommunity["community (作品筛选与点赞交互)"]
        FStore["store (Zustand 购物车与结算模拟)"]
        FAuth["auth (官网登录注册 / aud=web 会话维护)"]
    end

    subgraph Infra["基础设施与基础层 (src/services & src/core)"]
        Http["services/http.ts (Axios 封装 + 内存 tokenStore + 401 刷新)"]
        Telemetry["services/telemetry.ts (桥接 monitor-sdk)"]
        I18nTheme["i18n (zh-CN / en-US) + 语义主题 Token"]
    end

    Boot --> Providers --> Router --> Layout --> Pages
    HomeP --> FShowcase
    FlagshipP --> FShowcase
    AcademyP --> FAcademy
    CommunityP --> FCommunity
    StoreP --> FStore
    AuthP --> FAuth
    Features --> Http
    Features --> Telemetry
    Layout --> Telemetry
    Pages --> I18nTheme
```

**关键设计说明：**
- **严格分层边界**：页面组件位于 `web/src/pages/`，只负责组装 `web/src/features/<模块>/index.ts` 导出的组件与 Hook；跨模块不穿透内部私有文件。
- **状态职责划分**：服务端会话数据归 TanStack Query 管理；跨页面客户端状态（购物车、语言、深浅色主题）归 Zustand 管理；临时弹窗与表单输入归组件内 `useState`。
- **遥测无缝接入**：`web/src/services/telemetry.ts` 动态加载 `../sdk`，关闭 SDK 自动 PV 与原生 fetch 劫持，改由 `RouteTracker` 上报路由切换、由 `http.ts` 的 `errorReporter` 统一上报接口异常、由 `ErrorBoundary` 捕获渲染崩溃。
- **真实业务边界**：登录、注册、会话刷新、个人资料（`/profile`）及遥测上报均对接真实 Django 后端；但**机型预约、SN 码校验、购物车结算、学院课程与社区帖子目前基于前端本地状态与静态数据模拟**，不包含真实支付或 CMS 后端。

---

### 2.2 `admin/` —— 监控与系统管理后台（端口 `5174`）

`admin/` 是面向运维与研发团队的可观测性控制台与用户管理端，技术底座与 `web/` 同源，但使用独立的管理端鉴权通道（`/api/v1/admin/auth/*`）与自研零依赖 SVG 图表组件库。

```mermaid
flowchart LR
    subgraph GuardShell["守卫与全局外壳"]
        Guard["RouteGuards (校验登录态 + admin 或 monitor_viewer 角色)"]
        Shell["AdminLayout (侧边导航 + 全局项目/时间窗筛选器 + JwtSessionDialog)"]
        Filters["features/filters (Zustand 持久化 projectId / range / 浏览器 tz)"]
    end

    subgraph AdminPages["核心业务视图 (src/pages -> src/features)"]
        Dash["DashboardPage (概览大盘: 瓶颈雷达 + 容灾状态 + 8 项环比 + 趋势)"]
        Traffic["TrafficPage (访问分析: PV/UV/会话/加载耗时 + 页面/来源/终端排行)"]
        Events["EventsPage (用户埋点: 事件汇总排行 + 多条件行为明细检索)"]
        Errors["ErrorsPage / ErrorDetailPage (异常聚合指纹 + 堆栈 + Breadcrumbs + 状态流转)"]
        Logs["LogsPage (后端日志: 吞吐/5xx 趋势 + 慢接口 P95 + requestId 串联)"]
        Ips["IpsPage / IpDetailPage (IP 综合画像 + 黑名单封禁规则)"]
        Projects["ProjectsPage (项目 CRUD + appKey 轮换 + SDK 接入代码生成)"]
        Users["UsersPage (全平台账号列表 + 角色分配 admin/monitor_viewer/user)"]
    end

    subgraph ChartsInfra["可视化与通信底座"]
        SVGCharts["components/charts (单 Y 轴 SVG 折线 / 排行条 / 键盘十字准线 / 表格切换)"]
        QueryLayer["TanStack Query (60s 自动轮询 + placeholderData 保帧防闪烁)"]
        AdminHttp["services/http.ts (Bearer aud=admin + admin_refresh_token 静默续期)"]
        SelfMon["services/telemetry.ts (可选自监控: 用自身 SDK 监控后台)"]
    end

    Guard --> Shell
    Filters --> AdminPages
    Shell --> AdminPages
    AdminPages --> SVGCharts
    AdminPages --> QueryLayer --> AdminHttp
    Shell --> SelfMon
```

**关键设计说明：**
- **双级权限控制**：`RouteGuards` 在前端阻断 `role=user` 的普通会员并展示无权限提示，`/register` 强制重定向至 `/login`；所有写按钮（新建/删除项目、轮换 `appKey`、修改异常状态、增删 IP 黑名单、管理用户）通过 `useIsAdmin()` 按角色控制显隐，且后端接口独立强制校验。
- **全局筛选联动**：顶栏切换项目或时间范围（`1h` / `24h` / `7d` / `30d`）后，自动携带浏览器 IANA 时区（如 `Asia/Shanghai`）触发当前活动页面的 Query Key 重新拉取，并使用 `keepPreviousData` 策略保持旧帧半透明过渡，避免页面抖动。
- **无障碍图表体验**：`admin/src/components/charts/` 不引入重型图表库，支持键盘左右方向键移动十字准线、色盲友好配色及一键切换为结构化数据表格。

---

### 2.3 `sdk/` —— 零依赖浏览器遥测与 Node 日志 SDK（`monitor-sdk`）

`sdk/` 提供纯 TypeScript 编写的轻量级采集器（浏览器端压缩后约 10 KB），同时供 `web/`、`admin/` 通过源码别名直接引用，也可独立打包为 ESM / CJS / IIFE 发布。

```mermaid
flowchart TB
    subgraph BrowserEntry["浏览器入口 createMonitor (sdk/src/monitor.ts)"]
        Collectors["自动与手动采集器 (collectors/)"]
        AutoPV["PV 采集 (首屏 + History API 钩子 + popstate/hashchange)"]
        AutoClick["声明式点击采集 (data-track 属性委托)"]
        AutoErr["异常捕获 (error 捕获阶段 + unhandledrejection + 1s 去重 + 100 条上限)"]
        AutoHttp["HTTP 异常代理 (fetch / XHR 拦截, 默认状态码 >= 500)"]
        AutoPerf["首屏性能采集 (Navigation Timing + Paint FCP)"]
        ManualAPI["主动 API (track / captureError / identify / reset / flush)"]

        Identity["身份与会话管理 (identity.ts: 持久化 visitorId + 30min 滑动 sessionId)"]
        Breadcrumbs["用户操作面包屑缓冲 (最近 20 条点击/路由/请求/埋点)"]
        Filter["采样与脱敏钩子 (行为按 visitorId 采样, 异常 100% 保留 -> beforeSend)"]
        Queue["内存缓冲队列 (默认 10 条或 5000ms 触发批量 flush, 容量上限保护)"]
        Sender["传输层 (transport.ts: text/plain 免预检 POST / 卸载时 sendBeacon / 429 与 5xx 重试)"]
    end

    subgraph NodeEntry["Node 服务端入口 createLogShipper (sdk/src/node.ts)"]
        ReqLogger["Express / NestJS requestLogger() 中间件"]
        LogAPI["结构化 log(level, message, meta) 接口"]
        NodeQueue["批量缓冲队列 + SIGTERM close() 排空 -> POST /api/v1/ingest/logs"]
    end

    Collectors --> AutoPV & AutoClick & AutoErr & AutoHttp & AutoPerf & ManualAPI
    AutoPV & AutoClick & AutoErr & AutoHttp & AutoPerf & ManualAPI --> Breadcrumbs
    AutoPV & AutoClick & AutoErr & AutoHttp & AutoPerf & ManualAPI --> Identity
    Identity & Breadcrumbs --> Filter --> Queue --> Sender
    ReqLogger & LogAPI --> NodeQueue
```

**关键设计说明：**
- **防自激死锁**：SDK 内部发往上报 `endpoint` 的请求带有内部标记，不会被自身的 `fetch/XHR` 代理或异常监听器二次捕获，彻底杜绝无限递归风暴。
- **跨域零预检与卸载可靠投递**：浏览器平时以 `Content-Type: text/plain` 发送 JSON 体（配合请求体 `appKey`），绕开浏览器 CORS `OPTIONS` 预检开销；页面隐藏（`visibilitychange`）或关闭（`pagehide`）时自动切换 `navigator.sendBeacon` 投递剩余批次。

---

### 2.4 `server/` —— Django 5.2 模块化单体后端（端口 `9000`）

`server/` 是整个系统的认证中心、监控接收网关、流式队列消费者与分析查询引擎，遵循 `apps/<模块>` 垂直分层（薄视图 `views` → 序列化校验 `serializers` → 业务逻辑 `services` → 模型 `models`）。

```mermaid
flowchart TB
    subgraph WSGI["HTTP 接入与中间件链 (config/)"]
        ReqID["RequestIdMiddleware (透传或生成 X-Request-ID)"]
        SelfLog["SelfLogMiddleware (记录 10s/60s 实时流量滑窗 + 可选自身请求落库)"]
        URLRouter["config/urls.py (/api/*, /api/v1/auth/*, /api/v1/admin/auth/*, /api/v1/users, /api/v1/*)"]
    end

    subgraph CoreAuthUsers["基础与身份模块"]
        CoreMod["apps/core: ok()/page_result() 响应封装 + AppError 统一异常 + /health & /ready"]
        AuthMod["apps/auth: HS256 JWT(sub,role,aud) + SHA-256 RefreshToken + 端隔离权限类"]
        UsersMod["apps/users: PBKDF2 密码哈希 + 用户 CRUD + 启动自动播种演示账号"]
    end

    subgraph MonitorMod["监控核心模块 (apps/monitor)"]
        IngestSvc["services/ingest.py: 限流 -> appKey -> 黑名单 -> 截断清洗 -> 指纹归并 -> 批次幂等"]
        QueueSvc["services/queue.py: Lua 限长 XADD(:v2) / 旧 List 原子迁移 / XAUTOCLAIM 超时重领"]
        ResilienceSvc["services/resilience.py: 零依赖标准库 RESP2 客户端 + 200ms 熔断器 + 降级采样"]
        AnalyticsSvc["services/analytics.py & queries.py: 环比概览 / 时区时间桶 / 异常详情 / 日志 P95 / IP 画像"]
        SystemSvc["services/system.py & bottleneck.py: DB/Redis 探活 + LLEN/XLEN 深度 + /proc 采样 + 瓶颈分级"]
        WorkerCmd["management/commands/run_ingest_worker.py: 消费组循环领取 -> 事务落库 -> XACK+XDEL"]
    end

    ReqID --> SelfLog --> URLRouter
    URLRouter --> CoreMod & AuthMod & UsersMod & MonitorMod
    IngestSvc --> QueueSvc --> ResilienceSvc
    SystemSvc --> QueueSvc & ResilienceSvc
    WorkerCmd --> QueueSvc & IngestSvc
```

#### 核心数据库表结构与关联（ER 图）

```mermaid
erDiagram
    USERS ||--o{ REFRESH_TOKENS : "owns"
    PROJECTS ||--o{ EVENTS : "collects"
    PROJECTS ||--o{ ERROR_ISSUES : "aggregates"
    PROJECTS ||--o{ ERROR_EVENTS : "records"
    ERROR_ISSUES ||--o{ ERROR_EVENTS : "contains"
    PROJECTS |o--o{ SERVER_LOGS : "optional_ref"

    USERS {
        uuid id PK
        varchar email UK "小写唯一邮箱"
        varchar name "2~50 字符"
        varchar password_hash "PBKDF2 哈希"
        varchar role "user | monitor_viewer | admin"
        timestamp created_at
        timestamp updated_at
    }

    REFRESH_TOKENS {
        uuid id PK
        uuid user_id FK
        varchar token_hash UK "SHA-256 哈希"
        varchar audience "web | admin 会话隔离"
        timestamp expires_at
        timestamp created_at
    }

    PROJECTS {
        uuid id PK
        varchar name
        varchar app_key UK "公开上报凭证 pk_*"
        varchar description
        timestamp created_at
        timestamp updated_at
    }

    EVENTS {
        uuid id PK
        uuid project_id FK
        varchar type "pageview | track | performance"
        varchar name
        varchar path
        varchar visitor_id
        varchar session_id
        varchar ip
        json properties "超过 4KB 自动截断"
        timestamp created_at
    }

    ERROR_ISSUES {
        uuid id PK
        uuid project_id FK
        varchar fingerprint "与 project_id 联合唯一"
        varchar type "js | promise | resource | api | custom"
        varchar status "open | resolved | ignored"
        int count
        timestamp first_seen
        timestamp last_seen
    }

    ERROR_EVENTS {
        uuid id PK
        uuid project_id FK
        uuid issue_id FK
        text stack
        json breadcrumbs "最近操作轨迹"
        varchar release
        varchar ip
        timestamp created_at
    }

    SERVER_LOGS {
        uuid id PK
        uuid project_id FK "本服务自日志时为 NULL"
        varchar service
        varchar level "debug | info | warn | error"
        varchar request_id
        varchar path
        int status
        int duration_ms
        timestamp created_at
    }

    IP_RULES {
        uuid id PK
        varchar ip UK "封禁 IP"
        varchar note
        timestamp created_at
    }

    INGEST_RECEIPTS {
        uuid job_id PK "队列批次幂等收据"
        uuid project_id
        int accepted
        timestamp created_at
    }
```

---

### 2.5 `stress-test/` —— 独立全栈压力测试引擎

`stress-test/` 是与业务进程完全隔离的 Node.js + TypeScript 压测工具，用于验证静态资源、真实浏览器渲染、SDK 洪峰上报与后端聚合查询的承载表现。

```mermaid
flowchart LR
    CLI["cli.ts 参数解析 (环境 / 档位 / 套件 / 容量探顶)"] --> Gate["Preflight 强制健康门禁 (探测 Web / Admin / health / ready / 登录态)"]
    Gate -->|"全部就绪"| Runner["场景编排器 (scenarios/index.ts: 10 大压测场景)"]
    Gate -->|"任一失败"| Abort["非零退出码阻断并给出排障提示"]

    Runner --> HttpLoad["HTTP 并发引擎 (core/load-runner.ts: keep-alive 连接池 + 阶梯 VU 调度)"]
    Runner --> BrowserLoad["真实浏览器引擎 (browser/: Playwright 优先 -> 零依赖原生 CDP 回退)"]
    Runner -.->|"每 2s 刷新状态 + 请求附带 X-Stress-Run"| Heartbeat["core/heartbeat.ts (.active-run.json)"]

    HttpLoad & BrowserLoad --> Stats["指标聚合与 SLA 门禁 (core/stats.ts & capacity.ts)"]
    Stats -->|"区分总 rps 与未限流 successRps, 429 > 1% 判过载"| Reporters["多格式报告器 (reporters/: 自包含 SVG HTML + Markdown + JSON)"]
```

---

### 2.6 `deploy/` 与 CI/CD —— 双模式发布与容灾编排

仓库在 `deploy/`、`docker-compose.prod.yml` 与 `.github/workflows/ci-cd.yml` 中提供了完整的检查与部署链路，其中 `DEPLOY_MODE=local` 具备单机双端口无损切换与自动回滚验证能力：

```mermaid
flowchart TD
    Push["git push 推送至裸仓库 main 分支"] --> Hook["deploy/post-receive.sh (flock 串行锁 + 锁定完整提交 SHA)"]
    Hook --> Mode{"检查 DEPLOY_MODE"}

    Mode -->|"local 模式"| Archive["归档不可变源码目录 sources/SHA/release-ID"]
    Archive --> Check5["锁文件安装依赖 (uv sync --frozen / npm ci) + 五模块全量 check"]
    Check5 --> Migrate["执行向前兼容数据库迁移 (manage.py migrate)"]
    Migrate --> Candidate["在备用端口 (PORT 或 PORT+1) 启动候选 Gunicorn"]
    Candidate --> Probe1{"候选端口 /api/ready 就绪?"}
    Probe1 -->|"否"| KeepOld["终止候选进程, 现网网关毫发无损"]
    Probe1 -->|"是"| CopyAssets["增量保留历史哈希静态资源至共享 assets/ 目录"]
    CopyAssets --> ReloadNginx["生成新配置 -> nginx -t -> reload 切换双端静态目录与 upstream"]
    ReloadNginx --> Probe2{"校验双端网关 /api/ready 与 /__release == SHA?"}
    Probe2 -->|"通过"| CommitRelease["写入 active-port / active-revision, 优雅停止旧 Gunicorn"]
    Probe2 -->|"失败"| Rollback["恢复 nginx.previous.conf 循环重载核实旧版本, 未确认前保留候选进程"]

    Mode -->|"docker 模式"| DockerFlow["固定工作区检出 SHA -> 临时容器五端检查 -> Compose 构建迁移与单实例重建"]
```
