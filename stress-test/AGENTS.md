# AGENTS.md — drone-website-stress-test

修改前先阅读根目录 `AGENTS.md`、本文件与本目录 `README.md`；涉及后端压测载荷或断言时，以 `../server/docs/API_CONTRACT.md` 为准。

## 模块职责

独立的 Node.js + TypeScript 全栈压力测试引擎，与被测进程物理隔离，负责对 `web/`、`admin/`、`sdk/` 上报链路及 `server/` 全部核心接口执行高并发压力测试并产出可视化报告。

## 架构与分层约定

- `src/config/`：环境变量读取（`env.ts`）、容量档位预设（`presets.ts`，对齐 `docs/CICD_AND_DISASTER_RECOVERY.md` 的 L1~L3 阶段）与强类型契约（`types.ts`）。
- `src/core/`：Keep-Alive 高并发 HTTP 连接池（`http-client.ts`）、分阶段动态并发调度器（`load-runner.ts`）、分位统计与瓶颈诊断（`stats.ts`）、服务连通性与自动鉴权预检（`context.ts`）。
- `src/browser/`：真实无头浏览器双驱动适配（优先动态加载 `playwright`，未安装时自动回退至零外部依赖的原生 Chrome DevTools Protocol 驱动 `cdp-driver.ts`）。
- `src/scenarios/`：四大压测场景集（前端静态资源吞吐、真实浏览器渲染与交互、前端 SDK 批量上报、后端 API 与全栈混合流量）。
- `src/reporters/`：终端实时进度看板、JSON 原始数据、GitHub Markdown 摘要与内联 SVG 趋势图的自包含 HTML 报告。

## 必须遵守

- 单文件 ≤300 行，单目录 ≤8 个源码文件。
- 配置统一从 `src/config/env.ts` 读取；新增配置项同步更新 `.env.example`。
- 核心 HTTP 引擎与原生 CDP 驱动保持零第三方运行时强依赖；可选浏览器依赖（如 `playwright`）通过动态加载引入并在缺失时平滑降级。
- 不提交 `.env` 或 `reports/` 下生成的本地压测产物（除 `.gitkeep`）。

## 修改后检查

```bash
npm run check   # lint + typecheck + test + build
```

无法运行某个命令时，在回复中说明原因。
