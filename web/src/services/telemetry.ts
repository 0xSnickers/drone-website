import { createTelemetryProxy, type TelemetryProperties } from '@/core/telemetry/telemetry';
import { env } from '@/config/env';

/**
 * 应用唯一的遥测入口。
 * - 配置了 VITE_MONITOR_APP_KEY：接入同仓库自研 monitor-sdk，携带 CI/CD VITE_APP_RELEASE 版本号实时上报至监控中心。
 * - 否则 VITE_TELEMETRY_ENABLED=true 时按需加载 snk-telemetry（Sentry + PostHog）。
 */
export const telemetry = createTelemetryProxy();

async function initMonitor(appKey: string) {
  const { createMonitor } = await import('monitor-sdk');
  const monitor = createMonitor({
    endpoint: env.monitor.endpoint,
    appKey,
    release: env.appRelease,
    autoPageview: false,
    captureHttp: false,
    debug: env.isDev,
  });
  telemetry.setImplementation({
    ...monitor,
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
