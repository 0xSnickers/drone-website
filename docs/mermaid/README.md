# 架构与数据流 Mermaid 图解目录

更新日期：2026-11-25（Asia/Shanghai）。本目录使用标准 Mermaid 语法梳理 `drone-website` 仓库的**全栈架构分层**、**五个子项目与部署编排职责**以及**端到端核心数据流向步骤**。

## 文档导航

| 文档 | 核心内容 | 包含图表类型 |
|---|---|---|
| [项目架构流程图与子项目详解](PROJECT_ARCHITECTURE.md) | 全栈总体拓扑、`web/`、`admin/`、`sdk/`、`server/`、`stress-test/`、`deploy/` 内部架构、核心数据表 ER 关系与真实业务边界 | `flowchart`、`erDiagram` |
| [数据流向步骤图与分步解析](DATA_FLOW_STEPS.md) | 双端 Audience 鉴权隔离流、SDK 采集与 Redis Streams 幂等落库流、后台时区聚合查询流、实时流量与压测瓶颈感知流、全栈压测与网关蓝绿发布流 | `sequenceDiagram`、`flowchart`、`stateDiagram-v2` |

---

## 五大子项目与基础设施速览

| 模块目录 | 技术栈 | 默认端口 / 产物 | 核心定位与职责边界 |
|---|---|---|---|
| [`web/`](../../web/README.md) | React 19 + Vite 8 + Tailwind v4 + TanStack Query + Zustand | 开发 `5173` / 静态产物 `dist/` | AeroApex 无人机品牌官网：产品展示、飞行学院、航拍社区、商城展示与会员中心；接入 `monitor-sdk` 上报真实访问与异常 |
| [`admin/`](../../admin/README.md) | React 19 + Vite 8 + 无依赖 SVG 图表 + TanStack Query + Zustand | 开发 `5174` / 静态产物 `dist/` | 监控与管理后台：项目与 `appKey` 管理、用户角色管理、PV/UV 分析、埋点、异常聚合、服务日志、IP 画像/黑名单、实时压测瓶颈雷达 |
| [`sdk/`](../../sdk/README.md) | TypeScript 6 + tsup（零运行时第三方依赖） | 源码别名 `monitor-sdk` / 构建 `ESM/CJS/IIFE` | 浏览器遥测采集器（PV、点击、JS/Promise/资源/接口异常、Web Vitals、操作面包屑）与 Node 后端日志推送器（`monitor-sdk/node`） |
| [`server/`](../../server/README.md) | Python + Django 5.2 + DRF + PyJWT + Gunicorn | 开发 `9000` / 路由前缀 `/api/v1` | 统一模块化单体后端：`core`（统一响应/异常）、`auth`（双端 Audience JWT + 双 Cookie）、`users`（角色与目录）、`monitor`（接收、Streams 队列、聚合查询、系统健康） |
| [`stress-test/`](../../stress-test/README.md) | Node.js + TypeScript CLI + Playwright / 内置 CDP | CLI + `reports/*.{html,md,json}` | 独立全栈压测引擎：强制前置健康门禁、静态资源吞吐、真实无头浏览器交互、SDK 高频上报、混合负载与容量探顶评估 |
| [`deploy/`](../../docs/CICD_AND_DISASTER_RECOVERY.md) | Nginx + Shell + Docker Compose + GitHub Actions | 网关 `80` 或 `18080/18081` | 支持 `local`（不可变源码目录 + 双端口候选 Gunicorn + Nginx 切换回滚）与 `docker`（PostgreSQL 16 + Redis 7 + Worker 编排）双发布路径 |

## 相关参考文档

- 架构现状与边界说明：[../CURRENT_SOLUTION.md](../CURRENT_SOLUTION.md)
- 已完成项、测试证据与待办优先级：[../DEVELOPMENT_PROGRESS.md](../DEVELOPMENT_PROGRESS.md)
- 跨端接口与错误码准绳：[../../server/docs/API_CONTRACT.md](../../server/docs/API_CONTRACT.md)
- 部署、容灾与容量演进指南：[../CICD_AND_DISASTER_RECOVERY.md](../CICD_AND_DISASTER_RECOVERY.md)
