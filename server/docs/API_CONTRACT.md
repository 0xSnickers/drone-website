# 接口契约

5 个后端模板对外行为完全一致，也与 `my-frontend-template` 的请求层和 `scripts/mock-server.mjs` 一致：前端把 Mock 换成任意一个后端模板即可直接跑通。

改契约时必须同时改 5 个模板、`scripts/contract-test.mjs` 和本文件。

## 1. 基础

| 项 | 约定 |
|---|---|
| 默认端口 | `9000`（与前端 `VITE_API_PROXY_TARGET` / `API_BASE_URL` 默认值一致） |
| 业务接口前缀 | `/api/v1` |
| 运维接口 | `/api/health`、`/api/ready`（不带版本，不需要登录） |
| 请求 / 响应 | JSON，UTF-8；字段名 camelCase |
| 请求 ID | 读取请求头 `X-Request-ID`，没有则生成；原样写回响应头并记录到日志 |
| 语言 | 读取请求头 `Accept-Language`，决定错误 `message` 的语言 |
| CORS | `CORS_ORIGINS` 白名单 + `credentials: true`；允许 `Authorization`、`Content-Type`、`Accept-Language`、`X-Request-ID`，暴露 `X-Request-ID` |
| 时间 | ISO 8601 UTC 字符串 |
| ID | UUID 字符串 |

## 2. 响应结构

成功（HTTP 2xx）：

```json
{ "code": 0, "message": "success", "data": {} }
```

失败（HTTP 4xx / 5xx）：

```json
{ "code": "VALIDATION_ERROR", "message": "Invalid request parameters", "data": null, "details": { "email": ["..."] } }
```

- `code`：成功固定为数字 `0`；失败为大写下划线字符串错误码。前端以 `code === 0` 判断成功。
- `details`：可选，仅校验错误等场景返回，结构为 `{ 字段: [错误描述] }`。
- `message`：可直接展示给用户。按请求头 `Accept-Language` 返回（`zh` 开头 → 简体中文，其余 → 英文），文案见第 3 节；前端请求层会自动带上当前语言。
- 500 错误只返回通用文案，异常细节只写日志。

分页结果（`data` 部分）：

```json
{ "items": [], "pagination": { "page": 1, "limit": 10, "total": 0, "totalPages": 0 } }
```

查询参数 `page` 默认 1（≥1），`limit` 默认 10（1~100）。

## 3. 错误码

| HTTP | code | 场景 | zh 文案 | en 文案 |
|---|---|---|---|---|
| 400 | `VALIDATION_ERROR` | 参数、请求体、路径 ID 校验失败；JSON 解析失败 | 请求参数不合法 | Invalid request parameters |
| 401 | `UNAUTHORIZED` | 未携带 / 无效 / 过期的 accessToken；refresh_token 无效 | 未登录或登录已过期 | Authentication required |
| 401 | `INVALID_CREDENTIALS` | 登录邮箱或密码错误 | 邮箱或密码错误 | Invalid email or password |
| 403 | `FORBIDDEN` | 已登录但角色不足 | 没有权限执行该操作 | Permission denied |
| 404 | `NOT_FOUND` | 路由不存在 | 接口不存在 | Resource not found |
| 404 | `USER_NOT_FOUND` | 用户不存在（业务资源统一 `<RESOURCE>_NOT_FOUND`） | 用户不存在 | User not found |
| 405 | `METHOD_NOT_ALLOWED` | 路由存在但方法不支持（部分框架返回 404，均可接受） | 不支持的请求方法 | Method not allowed |
| 409 | `EMAIL_EXISTS` | 邮箱已被占用 | 该邮箱已注册 | Email already in use |
| 503 | `NOT_READY` | 就绪检查失败（数据库不可达） | 服务暂不可用 | Service not ready |
| 500 | `INTERNAL_ERROR` | 未处理异常 | 服务器内部错误 | Internal server error |

新增错误码时，同时在各模板的文案表里加中英文（Express `utils/messages.ts`、NestJS `common/http/messages.ts`、Django `apps/core/messages.py`、Gin `httpx/messages.go`、Spring `common/Messages.java`）。没有登记文案的错误码原样返回抛出时的 message。

## 4. 鉴权

- **accessToken**：JWT（HS256），`sub` 为用户 ID，`role` 为角色；有效期 `ACCESS_TOKEN_TTL` 秒（默认 900）。放在响应体里返回，前端只存内存，请求时带 `Authorization: Bearer <token>`。
- **refresh_token**：随机不透明字符串，数据库只存 SHA-256 哈希；有效期 `REFRESH_TOKEN_TTL` 秒（默认 7 天）。通过 Cookie 下发：
  `refresh_token=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=<ttl>`，`COOKIE_SECURE=true` 时加 `Secure`。
- refresh 不轮换 token（与 Next.js BFF 的 `/auth/session` 兼容），登出时吊销。
- 角色：`user`、`admin`。

| 方法 | 路径 | 鉴权 | 请求 | `data` |
|---|---|---|---|---|
| POST | `/api/v1/auth/register` | - | `{ name, email, password }` | `{ user, accessToken }` + Set-Cookie（201） |
| POST | `/api/v1/auth/login` | - | `{ email, password }` | `{ user, accessToken }` + Set-Cookie |
| POST | `/api/v1/auth/refresh` | Cookie | - | `{ user, accessToken }` |
| POST | `/api/v1/auth/session` | Cookie | - | 同 refresh（Next.js BFF 使用） |
| POST | `/api/v1/auth/logout` | Cookie（可选） | - | `{ success: true }` + 清除 Cookie |
| GET | `/api/v1/auth/me` | Bearer | - | `user` |

校验规则：`name` 去首尾空格后 2~50 字符；`email` 去空格并转小写后为合法邮箱；`password` 8~72 字符。

## 5. 用户

```json
{ "id": "uuid", "name": "Demo User", "email": "demo@example.com", "role": "admin", "createdAt": "...", "updatedAt": "..." }
```

永远不返回密码哈希。

| 方法 | 路径 | 鉴权 | 请求 | `data` |
|---|---|---|---|---|
| GET | `/api/v1/users?page=1&limit=10` | Bearer | - | 分页 `user` |
| GET | `/api/v1/users/:id` | Bearer | - | `user` |
| POST | `/api/v1/users` | admin | `{ name, email, password, role? }` | `user`（201） |
| PUT | `/api/v1/users/:id` | admin | `{ name?, email?, role? }` | `user` |
| DELETE | `/api/v1/users/:id` | admin | - | `{ id }` |

列表按 `createdAt` 倒序。

## 6. 运维接口

| 方法 | 路径 | `data` | 说明 |
|---|---|---|---|
| GET | `/api/health` | `{ status: "ok" }` | 存活检查，不访问外部资源 |
| GET | `/api/ready` | `{ status: "ready" }` | 执行 `SELECT 1`，失败返回 503 `NOT_READY` |

## 7. 演示账号

`SEED_DEMO_USER=true`（开发环境默认）时，启动时若不存在则创建：`demo@example.com` / `password123`，角色 `admin`。与前端 Mock 的演示账号一致。生产环境务必关闭。

## 8. 数据表

| 表 | 字段 |
|---|---|
| `users` | `id uuid PK`、`email varchar(255) UNIQUE`、`name varchar(50)`、`password_hash varchar(255)`、`role varchar(20) DEFAULT 'user'`、`created_at`、`updated_at` |
| `refresh_tokens` | `id uuid PK`、`user_id uuid FK → users ON DELETE CASCADE`、`token_hash varchar(64) UNIQUE`、`expires_at`、`created_at` |

---

# 监控扩展（monitor-server）

以下接口是本项目在模板契约之上新增的监控能力。通用约定（响应结构、错误体、分页、`Accept-Language`、`X-Request-ID`）与上文完全一致。

## 9. 新增错误码

| HTTP | code | 场景 | zh 文案 | en 文案 |
|---|---|---|---|---|
| 401 | `INVALID_APP_KEY` | 上报时 appKey 缺失或不存在 | appKey 无效 | Invalid app key |
| 403 | `IP_BLOCKED` | 上报方 IP 在黑名单中 | 该 IP 已被禁止上报 | This IP is blocked |
| 429 | `RATE_LIMITED` | 上报接口单 IP 每分钟超过 `INGEST_RATE_LIMIT` | 请求过于频繁，请稍后再试 | Too many requests |
| 404 | `PROJECT_NOT_FOUND` | 项目不存在 | 项目不存在 | Project not found |
| 404 | `ISSUE_NOT_FOUND` | 异常问题不存在 | 异常不存在 | Issue not found |
| 404 | `IP_RULE_NOT_FOUND` | 黑名单规则不存在 | IP 规则不存在 | IP rule not found |
| 409 | `IP_RULE_EXISTS` | IP 已在黑名单 | 该 IP 已在黑名单中 | IP is already blocked |

校验失败的 `details` 对嵌套字段使用点路径：`{ "events.0.type": ["..."] }`。

## 10. 统计查询参数（所有统计 / 明细接口通用）

| 参数 | 说明 |
|---|---|
| `projectId` | 可选，UUID；不传表示全部项目 |
| `range` | `1h` / `24h`（默认） / `7d` / `30d`；趋势粒度分别为分钟 / 小时 / 天 / 天 |
| `tz` | IANA 时区（如 `Asia/Shanghai`），按当地时间切分小时 / 天；非法值按 `UTC` |
| `page` / `limit` | 明细列表分页，`limit` 默认 20（1~100） |

趋势数据为连续时间桶（空桶补 0），`bucket` 为该桶起点的 ISO UTC 时间。

## 11. 上报接口（公开，用 appKey 识别项目）

- appKey 放在请求体 `appKey` 或请求头 `X-App-Key`；appKey 可以公开放在前端代码中。
- 允许任意来源跨域（不带 Cookie）；同时接受 `application/json` 和 `text/plain`（内容为 JSON，兼容 `navigator.sendBeacon`，避免 CORS 预检）。
- 校验顺序：限流（429）→ appKey（401）→ IP 黑名单（403）→ 字段校验（400）。
- IP、浏览器、系统、设备由服务端根据连接和 `User-Agent` 解析；`TRUST_PROXY=true` 时 IP 取自 `X-Forwarded-For`。
- 超长字符串截断而不是拒收；`properties` / `meta` / `breadcrumbs` 序列化后超过 4KB 时替换为 `{ "_truncated": true }`。
- 客户端时间 `ts` 只用于展示，超出 [当前 - 1 天, 当前] 时以服务端时间为准；统计一律按服务端接收时间。

| 方法 | 路径 | 请求 | `data` |
|---|---|---|---|
| POST | `/api/v1/ingest/events` | `{ appKey?, events: Event[1..100] }` | `{ accepted }` |
| POST | `/api/v1/ingest/logs` | `{ appKey?, service, logs: Log[1..200] }` | `{ accepted }` |

`Event`：

```json
{
  "type": "pageview | track | performance | error",
  "name": "事件名（pageview 固定为 pageview，performance 为 page_load）",
  "url": "https://app.example.com/cart?id=1",
  "referrer": "上一页地址（可选）",
  "visitorId": "匿名访客 ID（持久化）",
  "sessionId": "会话 ID（30 分钟无活动轮换）",
  "userId": "登录用户 ID（可选）",
  "release": "版本号（可选）",
  "ts": 1792850000000,
  "properties": { "任意": "附加属性" },
  "breadcrumbs": [{ "type": "click", "message": "button \"Pay\"", "ts": 1792850000000 }],
  "error": { "type": "js | promise | resource | api | custom", "message": "...", "stack": "...", "source": "app.js:1:20" }
}
```

`type = error` 的事件写入异常表：按「类型 + 归一化消息（去掉数字 / ID / 引号内容 / URL）+ 堆栈首帧（去掉行列号）」计算指纹，合并为一个问题（issue）；已解决（`resolved`）的问题再次出现时自动改回 `open`，已忽略（`ignored`）的保持忽略。

`Log`：`{ level: debug|info|warn|error, message, ts?, requestId?, method?, path?, status?(100~599), durationMs?, ip?（终端用户 IP）, userAgent?, meta? }`。

## 12. 查询接口（需要登录；写操作需要 admin）

| 方法 | 路径 | 权限 | 说明 / `data` |
|---|---|---|---|
| GET | `/api/v1/projects` | Bearer | 分页 `project` |
| GET | `/api/v1/projects/:id` | Bearer | `project` |
| POST | `/api/v1/projects` | admin | `{ name(2~50), description?(≤200) }` → `project`（201，自动生成 `appKey`） |
| PUT | `/api/v1/projects/:id` | admin | `{ name?, description? }` → `project` |
| POST | `/api/v1/projects/:id/rotate-key` | admin | 重置 appKey，旧 key 立即失效 → `project`（201） |
| DELETE | `/api/v1/projects/:id` | admin | 级联删除该项目全部监控数据 → `{ id }` |
| GET | `/api/v1/analytics/overview` | Bearer | `{ range, current: Totals, previous: Totals }`（previous 为上一个等长周期） |
| GET | `/api/v1/analytics/trend` | Bearer | `[{ bucket, pv, uv, errors, requests, serverErrors }]` |
| GET | `/api/v1/analytics/pages` | Bearer | 热门页面 `[{ path, pv, uv }]`（20 条） |
| GET | `/api/v1/analytics/audience` | Bearer | `{ referrers, browsers, systems, devices }` |
| GET | `/api/v1/events` | Bearer | 行为明细分页；筛选 `type` `name` `visitorId` `userId` `ip` `path` |
| GET | `/api/v1/events/summary` | Bearer | 埋点汇总 `[{ name, count, visitors, lastSeen }]` |
| GET | `/api/v1/errors/issues` | Bearer | 范围内发生过的问题分页（含 `rangeCount`、`users`）；筛选 `status` `type` `q`，`sort=frequent|recent` |
| GET | `/api/v1/errors/issues/:id` | Bearer | 问题 + `{ trend, users, browsers, systems }` |
| GET | `/api/v1/errors/issues/:id/events` | Bearer | 发生记录分页（堆栈、breadcrumbs、环境） |
| PUT | `/api/v1/errors/issues/:id` | admin | `{ status: open|resolved|ignored }` |
| GET | `/api/v1/logs` | Bearer | 日志分页；筛选 `service` `level` `statusClass(2xx..5xx)` `requestId` `ip` `q` |
| GET | `/api/v1/logs/stats` | Bearer | `{ levels, statuses, trend, slowest }`（慢接口按 P95 排序）；可选 `service` |
| GET | `/api/v1/logs/services` | Bearer | `[{ service, projectId, lastSeen }]` |
| GET | `/api/v1/ips` | Bearer | IP 汇总分页（合并前端事件、异常、后端请求）；`q` 为 IP 前缀 |
| GET | `/api/v1/ips/:ip` | Bearer | `{ summary, trend, pages, agents, visitors, errors, requests }` |
| GET | `/api/v1/ip-rules` | Bearer | 黑名单 |
| POST | `/api/v1/ip-rules` | admin | `{ ip, note? }` → 规则（201） |
| DELETE | `/api/v1/ip-rules/:id` | admin | `{ id }` |

`Totals`：`{ pv, uv, sessions, ips, events, errors, errorVisitors, requests, serverErrors, avgDurationMs, avgLoadMs, avgFcpMs }`。

## 13. 本服务自身日志

`SELF_LOG_ENABLED=true` 时，本服务每个请求（不含健康检查和成功的上报请求）以及应用级 warn / error（含异常堆栈）异步批量写入 `server_logs`，`projectId` 为空、`service` 为 `SERVICE_NAME`。

## 14. 数据表（新增）

| 表 | 说明 |
|---|---|
| `projects` | `id`、`name`、`app_key UNIQUE`、`description` |
| `events` | 访问 / 埋点 / 性能；索引 `(project_id, type, created_at)`、`created_at`、`ip` |
| `error_issues` | 按指纹聚合的问题；`UNIQUE (project_id, fingerprint)`、`status`、`count`、`first_seen`、`last_seen` |
| `error_events` | 每次发生；`issue_id → error_issues ON DELETE CASCADE` |
| `server_logs` | 后端日志；`project_id` 可空（本服务） |
| `ip_rules` | 黑名单，`ip UNIQUE` |

超过 `DATA_RETENTION_DAYS` 的事件、异常发生记录、日志每小时清理一次。
