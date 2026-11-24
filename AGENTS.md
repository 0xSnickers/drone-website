# drone-website

修改前先读本文件，再读所修改端的 AGENTS.md、README.md 和相关 docs/。

- 前台展示站位于 `web/`（React 19 + Vite，端口 `5173`）；遵循 features 分层、状态边界、i18n 和主题约定。生成后的 core 归本项目所有。
- 管理与监控端位于 `admin/`（React 19 + Vite，端口 `5174`，参考 `admin-system-template`）；负责项目管理、访问分析、用户埋点、前端异常、后端日志与 IP 监控。
- 零依赖上报 SDK 位于 `sdk/`，供 `admin/` 与 `web/` 上报运行数据。
- 统一后端位于 `server/`（Python / Django 5.2 + DRF，端口 `9000`）；遵循 `apps/<模块>` 分层。接口契约以 `server/docs/API_CONTRACT.md` 为准（包含基础鉴权/用户契约与监控管理扩展）。
- 只修改本项目，不需要修改或同步其他技术栈模板。
- 按对应端说明运行检查；缺少工具链时说明未验证范围。
