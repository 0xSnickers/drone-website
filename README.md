# drone-website

AeroApex 无人机展示与项目监控全栈项目：

```text
drone-website/
├── web/          # 前台官网（React 19 + Vite，http://localhost:5173）
├── admin/        # 管理与监控后台（React 19 + Vite，http://localhost:5174）
├── sdk/          # 零依赖监控上报 SDK（供 web/ 与 admin/ 引用）
├── server/       # 统一 Python 后端（Django 5.2 + DRF，http://localhost:9000）
└── stress-test/  # 独立前后端全链路压力测试模块（CLI + HTML/MD/JSON 报告）
```

## 开发启动

以下各组命令分别从项目根目录开始，在不同终端执行：

```bash
# 1. Python 后端（需要 uv 与 Docker PostgreSQL；无 DATABASE_URL 时可回落本地 sqlite）
cd server
./scripts/setup.sh
./scripts/db.sh up
./scripts/dev.sh
```

```bash
# 2. 前台官网
cd web
npm install
npm run dev
```

```bash
# 3. 管理与监控后台（默认登录账号：demo@example.com / password123）
cd admin
npm install
npm run dev
```

- 默认 API：`http://localhost:9000/api/v1`。
- 文档入口见 [`docs/README.md`](docs/README.md)；当前架构与交付边界见 [`docs/CURRENT_SOLUTION.md`](docs/CURRENT_SOLUTION.md)，已完成事项、验证结果与下一批待办见 [`docs/DEVELOPMENT_PROGRESS.md`](docs/DEVELOPMENT_PROGRESS.md)。
- 接口契约位于 `server/docs/API_CONTRACT.md`（包含基础鉴权/用户接口与监控管理扩展接口）。
- 生产部署、Git 自动化 CI/CD、四阶段扩容路线与容灾切换方案见 [`docs/CICD_AND_DISASTER_RECOVERY.md`](docs/CICD_AND_DISASTER_RECOVERY.md)（配套生产编排 `docker-compose.prod.yml` 与 `deploy/` 脚本）。
- 全栈压力测试模块与实测报告：
  - 压测引擎说明见 [`stress-test/README.md`](stress-test/README.md)（内置强制前置环境健康门禁，覆盖前端静态资源吞吐、真实无头浏览器渲染交互、监控 SDK 批量上报、后端 API 与混合流量压测）。
  - 历史本地与测试环境压测快照见 [`docs/STRESS_TEST_REPORT.md`](docs/STRESS_TEST_REPORT.md)；容量口径已修正，历史 CCU / DAU 尚未复测，不作为当前承载承诺。
  - 常用命令：`cd stress-test && npm install && npm run preflight`（前置环境检测）、`npm run stress`（本地环境压测）、`npm run stress:staging`（测试环境压测）、`npm run stress:capacity`（阶梯探顶评估可承载并发与用户数）。
- 检查命令：`cd sdk && npm run check`、`cd web && npm run check`、`cd admin && npm run check`、`cd server && ./scripts/test.sh`、`cd stress-test && npm run check`。
