# 项目文档

更新日期：2026-11-25（Asia/Shanghai）。当前说明对应本项目工作区，包含第一批优化的未提交改动；不代表这些改动已发布到生产环境。

## 阅读入口

- [当前方案](CURRENT_SOLUTION.md)：模块职责、权限、监控上报、代理信任、容量口径与当前技术边界。
- [架构与数据流图解（Mermaid）](mermaid/README.md)：全栈架构流程图、五个子项目内部结构详解与核心数据流向分步图。
- [开发进度](DEVELOPMENT_PROGRESS.md)：已完成事项、实际验证记录、待办优先级与上线前置事项。
- [部署与容灾指南](CICD_AND_DISASTER_RECOVERY.md)：local / Docker 两种发布方式、队列升级、备份与后续扩容规划。
- [历史压测报告](STRESS_TEST_REPORT.md)：2026-11-25 早先环境的压测快照；容量算法已修正，历史 CCU / DAU 尚未重新测量。

新成员先阅读“当前方案”，跟进工作时阅读“开发进度”，操作环境前再核对“部署与容灾指南”。

## 各端文档与实现依据

- 官网：[web/README.md](../web/README.md)、[开发约定](../web/docs/CONVENTIONS.md)、[测试说明](../web/docs/TESTING.md)。
- 监控后台：[admin/README.md](../admin/README.md)、[开发约定](../admin/docs/CONVENTIONS.md)、[测试说明](../admin/docs/TESTING.md)。
- 后端：[server/README.md](../server/README.md)、[接口契约](../server/docs/API_CONTRACT.md)、[测试说明](../server/docs/TESTING.md)。
- SDK：[sdk/README.md](../sdk/README.md)。
- 压测工具：[stress-test/README.md](../stress-test/README.md)。
- 修改约定：[根目录 AGENTS.md](../AGENTS.md)，以及所修改端的 `AGENTS.md`。

跨端 API 以 `server/docs/API_CONTRACT.md` 为准。各端部分架构文档仍保留模板来源说明；当前项目的权限、队列与发布能力，以本目录说明和当前代码为准。发现契约与实现的差异时，应先在进度文档登记，再同步修订，不能把契约中的目标能力记作已完成。

## 文档维护规则

1. 架构、状态边界或交付语义变化时，同步更新“当前方案”和相关端文档。
2. 完成任务时，在“开发进度”写明代码入口、验证命令、结果与未覆盖范围。
3. 区分“已实现”“已验证”“已部署”；CI 文件存在不等于远端流水线已经执行成功。
4. 历史报告保留原始环境和数值。复测产生新记录，不以新实现替换旧报告中的测量结果。
5. 规划写明触发条件与验收标准；未确定的排期、容量和 RTO / RPO 不作承诺。
