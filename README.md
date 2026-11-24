# drone-website

AeroApex 无人机展示与项目监控全栈项目：

```text
drone-website/
├── web/      # 前台官网（React 19 + Vite，http://localhost:5173）
├── admin/    # 管理与监控后台（React 19 + Vite，http://localhost:5174）
├── sdk/      # 零依赖监控上报 SDK（供 web/ 与 admin/ 引用）
└── server/   # 统一 Python 后端（Django 5.2 + DRF，http://localhost:9000）
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
- 接口契约位于 `server/docs/API_CONTRACT.md`（包含基础鉴权/用户接口与监控管理扩展接口）。
- 生产部署、Git 自动化 CI/CD、四阶段扩容路线与容灾切换方案见 [`docs/CICD_AND_DISASTER_RECOVERY.md`](docs/CICD_AND_DISASTER_RECOVERY.md)（配套生产编排 `docker-compose.prod.yml` 与 `deploy/` 脚本）。
- 检查命令：`cd sdk && npm run check`、`cd web && npm run check`、`cd admin && npm run check`、`cd server && ./scripts/test.sh`。
