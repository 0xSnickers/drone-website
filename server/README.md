# drone-website-server

本项目统一 API：Django 5.2 + Django REST Framework，包含官网鉴权与受限的监控管理能力。依赖用 uv 管理。

**技术栈**：Django 5.2 · DRF 3.16 · PyJWT · django-cors-headers · dj-database-url · gunicorn · pytest-django · ruff · uv

> 接口契约见 `docs/API_CONTRACT.md`（模板仓库根目录；用 `npm run create` 生成的项目已复制到本项目 `docs/` 下）。分层、开发约定、测试规范见仓库 `docs/ARCHITECTURE.md`、`docs/CONVENTIONS.md`、`docs/TESTING.md`。

## 快速开始

```bash
./scripts/setup.sh        # 复制 .env、安装依赖
./scripts/db.sh up        # 启动 PostgreSQL并执行 Django 迁移
./scripts/dev.sh          # http://localhost:9000/api/health
./scripts/test.sh         # ruff + pytest（内存 sqlite，不需要数据库）
```

演示账号：`demo@example.com` / `password123`（admin，`SEED_DEMO_USER=true` 时自动创建）。前端模板默认代理到 `http://localhost:9000/api/v1`，直接启动前端即可联调。

## 脚本

| 脚本 | 说明 |
|---|---|
| `setup.sh` | 首次安装：复制 `.env`、安装依赖 |
| `db.sh up` / `db.sh down` | 启停本地 PostgreSQL（`docker-compose.yml`） |
| `dev.sh` | 本地开发运行，日志同时写入 `logs/app.log` |
| `test.sh` | ruff + pytest（内存 sqlite，不需要数据库） |
| `db.sh makemigrations` | 修改模型后生成迁移 |
| `db.sh migrate` | 执行迁移 |
| `migrate-to-pg.sh <PG_URL>` | 一键无痛将本地 SQLite 迁移至 PostgreSQL（自动备份 + 建表 + 分批拷贝 + 行数校验） |

## 目录结构

```text
config/
├── settings.py        # 全部来自环境变量；DATABASE_URL 缺省回落到 sqlite；日志写 logs/app.log
├── test_settings.py   # pytest 专用（内存 sqlite、快速哈希）
├── urls.py            # /api/、/api/v1/auth/、/api/v1/users、JSON 404 兜底
└── wsgi.py            # 入口；SEED_DEMO_USER 时创建演示账号
apps/
├── core/              # responses · exceptions（统一异常处理）· messages（中英文案）· middleware · views
├── auth/              # models(RefreshToken) · tokens · authentication（Bearer / 权限类）· serializers · views · urls
└── users/             # models · serializers · services · views · urls · seed
tests/                 # conftest + ops / auth / users
```

## 鉴权与错误

```python
class OrderListView(APIView):
    permission_classes = [IsAuthenticated]  # 需要登录，request.user = AccessClaims(user_id, role)


class OrderAdminView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]  # 需要 admin（读写分离用 IsAdminForWrites）


raise AppError.not_found("ORDER_NOT_FOUND", "Order not found")
```

用户模型 `apps.users.User` 独立于 `django.contrib.auth`（模板不启用 Django Admin / Session）；密码用 Django 自带的 PBKDF2 哈希。

## 新增业务模块

以 `users` 为参照复制一份，挂到 `/api/v1/<资源>`，补测试。各模板的对照写法见 `docs/CONVENTIONS.md`。

## 项目权限与回归检查

公开注册仅创建 `user` 官网会员；监控查询要求 `admin` 或显式授予的 `monitor_viewer`，写操作与用户目录只允许 `admin`。当前只读监控角色可以访问全部项目，适用于单组织部署。已有管理员通过 `POST /api/v1/users` 或 `PUT /api/v1/users/:id` 授予角色；上线前执行新增迁移。

- `./scripts/check-contract.sh`：用临时 SQLite 和独立端口启动隔离 Gunicorn，执行 25 项接口契约检查，退出清理，不触碰开发数据库。显式设置 `CONTRACT_DATABASE_URL` 时可对测试 PostgreSQL 执行迁移与契约检查；该数据库需为隔离测试实例。
- `TEST_REDIS_URL=redis://127.0.0.1:6379/14 ./scripts/test.sh`：额外验证真实 Redis 7 的任务恢复、事务回滚、确认丢失去重、溢出背压和旧队列迁移。该地址必须指向测试实例；不配置时相关集成用例跳过。
- 本机具有 Nginx / Gunicorn 时，测试也会用临时目录和临时端口验证发布切换及失败回滚；包安装检查在这个发布测试中使用桩替代。
- `TRUST_PROXY=true` 需要同时配置实际代理的 `TRUSTED_PROXY_CIDRS`；容器代理地址通常不是回环地址，默认不会信任。边缘 Nginx 应覆盖外来 XFF。

Redis 队列实现位于 `services/queue.py`，不再使用先删除再落库的 List 消费方式。队列可靠性与降级语义见 API 契约第 11 节。

并发批次收据的数据库唯一约束恢复测试仅在 PostgreSQL 运行：准备独立测试数据库连接，以 `DATABASE_URL=<测试 PG> TEST_REDIS_URL=<测试 Redis> .venv/bin/pytest --ds=config.settings tests/integration/test_queue.py` 执行（pytest 会创建测试库；CI 已配置）。
