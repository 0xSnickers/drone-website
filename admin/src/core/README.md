# src/core

框架无关的公共基础层：HTTP 客户端、错误归一化、Token、环境变量校验、语言、主题、设计 Token、遥测接口。

本目录由前端模板生成，现在归本项目所有，可以直接修改。
业务代码通过 `@/core/...` 引入，例如 `import { AppApiError } from '@/core/http/apiError'`。
