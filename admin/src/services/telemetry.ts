import { createTelemetryProxy, type TelemetryProperties } from '@/core/telemetry/telemetry';
import { env } from '@/config/env';

/**
 * 应用唯一的遥测入口。业务代码只调用 `telemetry.track / captureError / ...`。
 * - 配置了 VITE_MONITOR_APP_KEY：用本系统自己的 SDK（../sdk）上报到监控后端，即「自己监控自己」。
 * - 否则 VITE_TELEMETRY_ENABLED=true 时按需加载 snk-telemetry（Sentry + PostHog）。
 * 两者都不启用时是空实现，SDK 不会进入首屏包。
 */
export const telemetry = createTelemetryProxy();

async function initMonitor(appKey: string) {
  const { createMonitor } = await import('monitor-sdk');
  const monitor = createMonitor({
    endpoint: env.monitor.endpoint,
    appKey,
    release: env.appRelease,
    // 路由 PV 由 RouteTracker 上报；接口错误由 services/http 的 errorReporter 上报，避免重复。
    autoPageview: false,
    captureHttp: false,
    debug: env.isDev,
  });
  telemetry.setImplementation({
    ...monitor,
    // http 客户端上报的接口错误（source: api_*）归类为「接口」异常，消息统一成「方法 路径 状态码」。
    captureError(error: unknown, properties?: TelemetryProperties) {
      const source = String(properties?.source ?? '');
      if (!source.startsWith('api_')) return monitor.captureError(error, properties);
      const { method = 'GET', url = '', status } = properties ?? {};
      const message = `${String(method).toUpperCase()} ${String(url).split('?')[0]} ${String(status ?? (error as Error)?.message ?? '')}`;
      monitor.captureError(new Error(message), properties, { type: 'api' });
    },
    identify: (user) => monitor.identify({ id: user.id, role: user.role }),
  });
}

async function initSnkTelemetry() {
  const { createReactTelemetry } = await import('snk-telemetry-reactjs');
  const client = createReactTelemetry({
    appName: env.appName,
    environment: env.appEnv,
    release: env.appRelease,
    enabled: true,
    sentry: env.telemetry.sentry,
    posthog: env.telemetry.posthog,
    onAdapterError(error) {
      if (env.isDev) console.warn('[telemetry] adapter failed', error);
    },
  });
  client.init();
  telemetry.setImplementation({
    ...client,
    identify: (user) => client.identify({ ...user, email: user.email ?? undefined }),
  });
}

export async function initTelemetry(): Promise<void> {
  try {
    if (env.monitor.appKey) await initMonitor(env.monitor.appKey);
    else if (env.telemetry.enabled) await initSnkTelemetry();
  } catch (error) {
    if (env.isDev) console.warn('[telemetry] init failed', error);
  }
}
