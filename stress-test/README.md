# AeroApex 全栈压力测试模块 (`stress-test`)

面向 `drone-website` 前后端全链路的独立压力测试模块（Node.js + TypeScript）。与被测服务进程隔离运行，覆盖 **前端静态资源并发吞吐**、**真实无头浏览器渲染与交互压测**、**前端监控 SDK 高频批量上报压测** 以及 **后端 API 全链路与混合业务流压测**，一键输出自包含 HTML 可视化报告、Markdown 摘要与 JSON 原始指标。

## 1. 覆盖维度与场景矩阵

| 场景 ID | 维度分类 | 压测目标与验证内容 | 核心采集指标 |
| --- | --- | --- | --- |
| `frontend-web-assets` | 前端资源并发吞吐 | 高并发请求 `web/` 全部公开路由与自动解析的 JS/CSS 静态产物 | RPS、带宽 MB/s、TTFB P95、P50/P95/P99、错误率 |
| `frontend-admin-assets` | 前端资源并发吞吐 | 高并发请求 `admin/` 路由入口与构建静态资源 | RPS、带宽 MB/s、TTFB P95、P50/P95/P99、错误率 |
| `frontend-web-browser` | 真实浏览器渲染与交互 | 多实例并发打开 `web/` 各页面，执行分段滚动与交互悬停触发 | FCP、LCP、DCL、Load、交互耗时、JS Heap 峰值、DOM 节点数、未捕获 JS 异常 |
| `frontend-admin-browser` | 真实浏览器渲染与交互 | 多实例并发加载 `admin/` 登录与控制台视图，模拟受控表单高频输入 | FCP、LCP、Load、表单交互耗时、JS Heap 峰值、JS 异常 |
| `frontend-sdk-ingest` | 前端 SDK 高频上报 | 50% `application/json` (`X-App-Key`) + 50% `text/plain` (`sendBeacon` 模式) 批量上报 `pageview / track / performance / error` | RPS、事件吞吐量、429 限流命中数、P95/P99 |
| `backend-ops-probes` | 后端运维探针 | 高并发请求 `/api/health` 与 `/api/ready`（验证 `SELECT 1` 连接池稳定性） | RPS、TTFB、P95/P99 |
| `backend-ingest-logs` | 后端日志写入链路 | 批量并发写入 `/api/v1/ingest/logs` 多级别微服务请求日志 | RPS、落库延迟 P95/P99、429 限流计数 |
| `backend-auth-users` | 后端鉴权与会话链路 | 真实比例混合压测 `/auth/me`、`/users`、`/auth/refresh` 与 `/auth/login` | RPS、JWT 校验与密码哈希延迟 P95/P99 |
| `backend-monitor-queries` | 后端监控聚合查询 | 并发请求 `/analytics/overview`、`trend`、`pages`、`audience`、`/events`、`/errors/issues`、`/logs/stats`、`/ips` | 范围聚合查询 P50/P95/P99、错误率 |
| `mixed-realistic-traffic` | 全栈真实混合负载 | `45%` 前端访问 + `30%` SDK 上报 + `15%` 监控大盘查询 + `10%` 鉴权探针 | 综合 RPS、端到端 P95/P99、SLA 达标率 |

## 2. 容量档位预设（对齐架构容量规划）

压测档位与 [`../docs/CICD_AND_DISASTER_RECOVERY.md`](../docs/CICD_AND_DISASTER_RECOVERY.md) 中的四阶段容量路线一一对应：

- `smoke`：快速冒烟（4 -> 8 VUs，适合本地开发联调与 CI 门禁自检）
- `l1-baseline`：L1 起步期基线（阶梯加压至 30 VUs，验证 DAU < 5,000 单机 SLA）
- `l2-growth`：L2 增长期水位（阶梯加压至 100 VUs，验证峰值 QPS ~300 表现）
- `l3-burst`：L3 爆发期高压（阶梯加压至 250 VUs，检验 `INGEST_MODE=redis_queue` 异步削峰与连接池极限）
- `spike`：瞬时脉冲洪峰（10 -> 180 -> 15 VUs，验证突发洪峰限流保护与回落自愈能力）

## 3. 快速上手（强制前置环境检测）

压测引擎内置 **强制前置环境健康门禁（Pre-flight Health Gate）**：每次发起压测前都会先逐项校验当前套件所需的 `Web`、`Admin`、后端 `/api/health`、数据库 `/api/ready` 以及管理账号登录态；若任意必需服务未正常启动，**立即阻断压测并以非零退出码返回明确排查建议**（除非显式追加 `--allow-partial`）。

```bash
cd stress-test
npm install

# 0. 压测前环境健康探活检测（仅检测连通性与就绪度，不发压测流量）
npm run preflight            # 检测本地环境 (5173 / 5174 / 9000)
npm run preflight:staging    # 检测测试网关环境 (18080 / 18081 / 18080)

# 1. 快速冒烟压测
npm run stress:smoke

# 2. 运行本地环境 (5173 / 5174 / 9000) L1 全栈基线压测
npm run stress

# 3. 运行测试环境 (18080 / 18081 / 18080) L1 全栈基线压测
npm run stress:staging

# 4. 阶梯探顶模式：自动递增并发采集 RPS、P95 拐点、CPU/Load/内存水位并换算可承载在线用户数 (CCU / DAU)
npm run stress:capacity
npm run stress -- --env staging --suite assets --capacity --capacity-steps 100,300,500,800

# 5. 仅压测前端（静态资源 + 浏览器渲染交互 + SDK 上报）或仅压测后端 API
npm run stress:frontend
npm run stress:backend

# 6. 自定义档位、并发数、持续秒数与 CI 严格模式
npm run stress -- --env staging --profile l2-growth --suite mixed --concurrency 80 --duration 15 --strict
```

### 关于真实浏览器压测驱动 (`--browser-driver`)

默认 `auto` 模式按以下顺序自动探测：
1. 若已安装 Playwright（`npm i -D playwright && npx playwright install chromium`），优先使用 Playwright Chromium；
2. 若未安装 Playwright，自动回退至内置 **零外部依赖 Chrome DevTools Protocol (CDP)** 驱动，直接调用本机 Chrome / Chromium（可通过 `STRESS_CHROME_BIN` 指定路径）；
3. 若容器/无头环境未安装任何浏览器二进制，浏览器场景将标记为 `SKIPPED` 并在报告中给出提示，不阻塞其余 HTTP 压测场景。

### 关于单 IP 限流 (HTTP 429) 与海量访客模拟

后端 `/api/v1/ingest/*` 默认启用单 IP 速率限制（`INGEST_RATE_LIMIT=600`/分钟）：
- 默认压测（不带 `--simulate-ips`）可验证单 IP 限流器是否正常返回 `429 RATE_LIMITED`（压测引擎会将预期内的 `429` 单独统计为限流保护命中，不计入服务崩溃错误率）。
- 若需绕过单 IP 限流测试后端真实多访客写入吞吐上限，可在后端 `.env` 开启 `TRUST_PROXY=true`，并执行：
  ```bash
  npm run stress:sdk -- --profile l2-growth --simulate-ips
  ```

## 4. 压测报告查看

每次运行完成后自动输出至 `stress-test/reports/`：
- `reports/latest.html`：自包含可视化报告（深浅色自适应、内联 SVG 吞吐与 P95 延迟曲线、Web Vitals 卡片、瓶颈调优建议）
- `reports/latest.md`：GitHub Flavored Markdown 报告（可直接贴入 PR 或归档）
- `reports/latest.json`：完整结构化原始指标（便于自动化对比基线）

## 5. 开发检查

```bash
npm run check   # eslint + tsc --noEmit + vitest + tsup build
```
