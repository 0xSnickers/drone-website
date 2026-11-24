# monitor-web

监控后台前端：概览、访问分析、用户埋点、前端异常、后端日志、IP 监控、项目管理。基于 `my-frontend-template` 的 React 模板生成，目录结构、请求层、鉴权、i18n、主题与模板一致。

## 页面

| 路由 | 页面 | 内容 |
|---|---|---|
| `/` | 概览 | 8 项核心指标（含环比）、访问趋势、前端异常 / 后端请求 / 5xx 趋势、高频异常、热门页面 |
| `/traffic` | 访问分析 | PV / UV / 会话 / IP / 加载性能、趋势、页面排行、来源、浏览器 / 系统 / 设备 |
| `/events` | 用户埋点 | 事件汇总（次数 / 人数），点击事件名筛选明细；明细支持访问 / 埋点 / 性能 |
| `/errors`、`/errors/:id` | 前端异常 | 问题列表（状态 / 类型 / 关键字 / 排序）；详情含趋势、分布、堆栈、操作路径、发生记录，admin 可标记解决 / 忽略 |
| `/logs` | 后端日志 | 请求量 / 5xx 趋势、级别 / 状态码分布、慢接口 P95；日志表按服务 / 级别 / 状态码 / 关键字筛选，点击请求 ID 串联同一请求 |
| `/ips`、`/ips/:ip` | IP 监控 | IP 汇总排行、单 IP 画像（页面、设备、访客、异常、请求）、黑名单 |
| `/projects` | 项目管理 | 新建 / 编辑 / 删除项目，重置 appKey，按项目生成接入代码 |

顶部的「时间范围 + 项目」是全局筛选（`features/filters`，Zustand 持久化），作用于所有页面；统计按浏览器时区切分小时 / 天，每分钟自动刷新，刷新时图表保持上一帧并半透明，不闪烁。

**权限**：所有页面需要登录；写操作（项目、异常状态、黑名单）需要 admin，后端同样校验。

## 图表

`src/components/charts` 是无依赖的 SVG 图表（折线、排行条、指标卡），遵循：

- 单 Y 轴（量级不同的指标拆成两张图，例如请求量与 5xx）；
- 系列色 `--series-1/2/3`（`styles/globals.css`）浅色 / 深色分别校验过色盲区分度与对比度，文字只用文字色；
- 十字准线 tooltip 列出所有系列的值，键盘可用（聚焦图表后 ←/→）；每张图都能切换为数据表；
- 好坏色（`--success` / `--critical`）只表达状态，并总是配图标和文字。

## 自监控（用自己的 SDK 监控这个后台）

`.env` 中 `VITE_MONITOR_APP_KEY=pk_demo_web`（后端演示项目）时，`services/telemetry.ts` 会按需加载 `../sdk` 并接入模板的 `Telemetry` 接口：路由 PV 由 `RouteTracker` 上报，接口错误由 http 客户端的 errorReporter 上报（归类为「接口」异常），渲染错误由 ErrorBoundary 上报。留空则关闭。

SDK 通过 Vite / TS 别名 `monitor-sdk -> ../sdk/src/index.ts` 直接引用源码，无需先构建。

## 技术栈

| 类别        | 选型                                                      |
| ----------- | --------------------------------------------------------- |
| 框架 / 构建 | React 19 · Vite 8 · TypeScript 6（strict）                |
| 路由        | React Router 7（data router，页面懒加载）                 |
| 服务端状态  | TanStack Query 5                                          |
| 客户端状态  | Zustand 5                                                 |
| 请求        | Axios（经 `src/core/http/createHttpClient` 封装）         |
| UI          | Tailwind CSS v4 · shadcn/ui · Radix UI · lucide-react     |
| 国际化      | react-i18next（`zh-CN` / `en-US`）                        |
| 校验        | zod                                                       |
| 测试        | Vitest · React Testing Library · jsdom                    |
| 遥测        | snk-telemetry-reactjs（Sentry + PostHog，可选、按需加载） |

## 快速开始

```bash
npm install    # 需要 npm 11：npm 10 可能报 Cannot read properties of null (reading 'edgesOut')
cp .env.example .env
npm run dev    # http://localhost:5173（先启动 ../server）
```

浏览器请求同源 `/api/*`，开发环境由 Vite 代理到 `VITE_API_PROXY_TARGET`（默认 `http://localhost:9000/api/v1`）。

## 常用命令

| 命令                              | 说明                            |
| --------------------------------- | ------------------------------- |
| `npm run dev`                     | 开发服务器                      |
| `npm run build`                   | 类型检查 + 生产构建             |
| `npm run preview`                 | 预览构建产物                    |
| `npm run lint` / `lint:fix`       | ESLint                          |
| `npm run format` / `format:check` | Prettier                        |
| `npm run typecheck`               | TypeScript 检查                 |
| `npm run test` / `test:watch`     | 单元测试                        |
| `npm run check`                   | lint + typecheck + test + build |

## 目录结构

```text
src/
├── main.tsx · app/                 # 入口、Provider、路由表（GuestOnly: 登录注册 / RequireAuth: 监控页面）
├── core/                           # 框架无关基础层（来自模板，归本项目所有）
├── config/env.ts                   # 环境变量（含 VITE_MONITOR_*）
├── services/                       # http · queryClient · telemetry（接入 ../sdk）
├── i18n/                           # 基础语言包 + extra/zh-CN.ts、en-US.ts（监控文案）
├── types/monitor.ts                # 跨模块类型：RangeParams、时间范围
├── lib/                            # format（数字 / 时长 / 时间桶）、http-status
├── features/
│   ├── auth/                       # 模板：登录、会话、路由守卫；useIsAdmin
│   ├── filters/                    # 全局筛选（项目 + 时间范围）
│   ├── analytics/                  # 指标卡、趋势卡、页面 / 来源 / 设备排行
│   ├── events/ errors/ logs/ ips/ projects/
├── components/
│   ├── charts/                     # SVG 折线图、排行条、指标卡、图表 / 表格切换
│   ├── ui/                         # shadcn 风格：button、input、dialog、card、badge、select、table、pagination
│   ├── layout/                     # AdminLayout（侧边栏 + 筛选）、AuthLayout、PageHeader
│   └── error/
├── pages/                          # 每个路由一个页面，只做组合
└── test/
```

## 环境变量

| 变量                                      | 说明                                              | 默认                           |
| ----------------------------------------- | ------------------------------------------------- | ------------------------------ |
| `VITE_APP_NAME`                           | 应用名称                                          | `监控中心`                     |
| `VITE_APP_ENV`                            | `development` / `test` / `staging` / `production` | `development`                  |
| `VITE_APP_RELEASE`                        | 版本号（Sentry release）                          | —                              |
| `VITE_API_BASE_URL`                       | 浏览器请求前缀；也可以是完整地址                  | `/api`                         |
| `VITE_API_PROXY_TARGET`                   | 开发代理目标（仅 `npm run dev`）                  | `http://localhost:9000/api/v1` |
| `VITE_MONITOR_ENDPOINT`                   | 自监控上报地址                                    | `/api`                         |
| `VITE_MONITOR_APP_KEY`                    | 自监控 appKey，留空关闭                           | `pk_demo_web`（.env.example）  |
| `VITE_TELEMETRY_ENABLED`                  | 未配置自监控时，是否启用 Sentry / PostHog         | `false`                        |
| `VITE_SENTRY_DSN` / `VITE_POSTHOG_KEY` 等 | 遥测配置                                          | —                              |

## 开发指南

- 新增业务模块、接口、状态、组件：见 `docs/CONVENTIONS.md`。
- 新增页面：在 `src/pages` 新建组件，在 `src/app/router.tsx` 对应分组中注册（需要登录的放进 `RequireAuth` 分组）。
- 架构与流程图：`docs/ARCHITECTURE.md`；测试规范：`docs/TESTING.md`。

> 在模板仓库中，`docs/` 位于仓库根目录；通过 `npm run create` 生成的项目会自带 `docs/`。
