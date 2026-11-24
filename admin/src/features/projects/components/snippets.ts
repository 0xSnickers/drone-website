/** 接入代码片段（appKey 与上报地址按项目填充）。 */
export function integrationSnippets(appKey: string, endpoint: string) {
  return {
    npm: `// 1. 安装：把本仓库的 sdk/ 发布到私有 npm，或 npm i ../admin-system-template/sdk
import { createMonitor } from 'monitor-sdk';

export const monitor = createMonitor({
  endpoint: '${endpoint}',
  appKey: '${appKey}',
  release: import.meta.env.VITE_APP_RELEASE,
});

// 自动采集：PV（含 SPA 路由）、JS / Promise / 资源 / 接口异常、页面性能
// 手动埋点：
monitor.track('add_to_cart', { sku: 42 });
monitor.identify({ id: user.id });

// 声明式埋点：点击即上报
// <button data-track="signup_click" data-track-plan="pro">注册</button>`,
    script: `<script src="https://your-cdn.example.com/monitor-sdk.global.js"></script>
<script>
  window.monitor = MonitorSDK.createMonitor({
    endpoint: '${endpoint}',
    appKey: '${appKey}',
  });
</script>`,
    template: `// 由 my-frontend-template 生成的项目：只改 src/services/telemetry.ts
import { createMonitor } from 'monitor-sdk';

export async function initTelemetry() {
  const monitor = createMonitor({
    endpoint: '${endpoint}',
    appKey: '${appKey}',
    autoPageview: false, // 模板的 RouteTracker 已上报 PV
    captureHttp: false,  // 模板的 http errorReporter 已上报接口错误
  });
  telemetry.setImplementation(monitor); // 实现了 core/telemetry 的 Telemetry 接口
}`,
    backend: `// Node 后端（Express / Nest）：请求日志 + 应用日志
import { createLogShipper } from 'monitor-sdk/node';

const shipper = createLogShipper({
  endpoint: '${endpoint}',
  appKey: '${appKey}',
  service: 'order-api',
});
app.use(shipper.requestLogger());
shipper.log({ level: 'error', message: 'payment timeout', meta: { orderId } });

# 其他语言直接调用 HTTP 接口：
curl -X POST '${endpoint}/ingest/logs' \\
  -H 'Content-Type: application/json' -H 'X-App-Key: ${appKey}' \\
  -d '{"service":"order-api","logs":[{"level":"error","message":"db timeout","status":503,"durationMs":3000}]}'`,
  };
}

export type SnippetKey = keyof ReturnType<typeof integrationSnippets>;
