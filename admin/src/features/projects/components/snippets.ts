/** 接入代码片段（appKey 与上报地址按项目填充）。 */
export function integrationSnippets(appKey: string, endpoint: string) {
  return {
    npm: `// 1. 同仓库通过 Vite alias 直接引入 '../sdk/src/index.ts'，或安装私有包 monitor-sdk
import { createMonitor } from 'monitor-sdk';

export const monitor = createMonitor({
  endpoint: '${endpoint}',
  appKey: '${appKey}',
  // CI/CD 自动注入当前发布的 Git 短 SHA，用于异常与事件版本归因
  release: import.meta.env.VITE_APP_RELEASE,
});

// 自动采集：PV（含 SPA 路由）、JS / Promise / 资源 / 接口异常、页面性能
// 手动埋点：
monitor.track('preorder_click', { edition: 'combo' });
monitor.identify({ id: user.id });

// 声明式埋点：点击即上报
// <button data-track="preorder_click" data-track-edition="pro">立即预订</button>`,
    script: `<script src="https://cdn.aeroapex.example.com/monitor-sdk.global.js"></script>
<script>
  window.monitor = MonitorSDK.createMonitor({
    endpoint: '${endpoint}',
    appKey: '${appKey}',
    release: 'v1.0.0',
  });
</script>`,
    template: `// AeroApex 前台展示站（web/src/services/telemetry.ts）标准接入方式：
import { createMonitor } from 'monitor-sdk';

export async function initTelemetry() {
  const monitor = createMonitor({
    endpoint: '${endpoint}',
    appKey: '${appKey}',
    release: env.appRelease, // CI/CD 构建期自动注入
    autoPageview: false,     // RouteTracker 已上报路由 PV
    captureHttp: false,      // services/http errorReporter 已统一归类接口异常
  });
  telemetry.setImplementation(monitor);
}`,
    backend: `// Node 后端（Express / Nest）：请求日志 + 应用日志
import { createLogShipper } from 'monitor-sdk/node';

const shipper = createLogShipper({
  endpoint: '${endpoint}',
  appKey: '${appKey}',
  service: 'drone-telemetry-api',
});
app.use(shipper.requestLogger());
shipper.log({ level: 'error', message: 'flight telemetry timeout', meta: { droneId } });

# 其他语言直接调用 HTTP 接口：
curl -X POST '${endpoint}/ingest/logs' \\
  -H 'Content-Type: application/json' -H 'X-App-Key: ${appKey}' \\
  -d '{"service":"drone-api","logs":[{"level":"error","message":"db timeout","status":503,"durationMs":3000}]}'`,
  };
}

export type SnippetKey = keyof ReturnType<typeof integrationSnippets>;
