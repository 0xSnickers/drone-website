import type { HttpRequestSpec, LoadProfile } from '../config/types';
import type { RuntimeContext } from '../core/context';
import type { HttpScenarioDefinition } from '../core/load-runner';
import { buildSdkEventBatch, randomSimulatedIp } from './frontend-sdk';

const MONITOR_QUERY_PATHS = [
  '/api/v1/analytics/overview?range=24h&tz=Asia%2FShanghai',
  '/api/v1/analytics/trend?range=24h&tz=Asia%2FShanghai',
  '/api/v1/analytics/pages?range=24h&tz=Asia%2FShanghai',
  '/api/v1/analytics/audience?range=7d&tz=Asia%2FShanghai',
  '/api/v1/events?page=1&limit=20&range=24h',
  '/api/v1/events/summary?range=24h',
  '/api/v1/errors/issues?page=1&limit=20&range=24h&sort=frequent',
  '/api/v1/logs?page=1&limit=20&range=24h',
  '/api/v1/logs/stats?range=24h',
  '/api/v1/ips?page=1&limit=20&range=24h',
  '/api/v1/projects?page=1&limit=10',
];

function validateApiEnvelope(_status: number, bodyText: string): string | null {
  try {
    const parsed = JSON.parse(bodyText) as { code?: unknown };
    return parsed.code === 0 ? null : `API_CODE_${String(parsed.code)}`;
  } catch {
    return 'INVALID_JSON_RESPONSE';
  }
}

function buildServerLogBatch(
  appKey: string,
  batchSize: number,
  workerId: number,
  iteration: number,
): string {
  const now = Date.now();
  const levels = ['info', 'info', 'info', 'debug', 'warn', 'error'] as const;
  const paths = ['/api/v1/orders', '/api/v1/telemetry/sync', '/api/v1/firmware/check'];
  const logs = Array.from({ length: batchSize }, (_, idx) => {
    const level = levels[(workerId + iteration + idx) % levels.length]!;
    return {
      level,
      message: `Processed drone flight telemetry frame #${iteration * batchSize + idx}`,
      ts: now - idx * 10,
      requestId: `req_stress_${workerId}_${iteration}_${idx}`,
      method: idx % 3 === 0 ? 'POST' : 'GET',
      path: paths[idx % paths.length]!,
      status: level === 'error' ? 502 : level === 'warn' ? 429 : 200,
      durationMs: 12 + ((workerId + idx * 7) % 85),
      ip: `192.168.10.${((workerId + idx) % 240) + 2}`,
      userAgent: 'AeroApex-FlightController/2.4',
      meta: { region: 'cn-south', firmware: '2.4.1' },
    };
  });

  return JSON.stringify({
    appKey,
    service: 'flight-gateway',
    logs,
  });
}

export function buildBackendApiScenarios(
  ctx: RuntimeContext,
  profile: LoadProfile,
): HttpScenarioDefinition[] {
  if (!ctx.reachability.server.reachable) {
    return [];
  }

  const scenarios: HttpScenarioDefinition[] = [
    {
      id: 'backend-ops-probes',
      name: '后端存活与数据库就绪探针 (/api/health & /api/ready)',
      category: 'backend-api',
      targetUrl: `${ctx.config.serverUrl}/api/ready`,
      phases: profile.httpPhases,
      timeoutMs: profile.timeoutMs,
      sla: profile.sla.backendApi,
      nextRequest: (workerId, iteration) => {
        const endpoint = iteration % 3 === 0 ? '/api/ready' : '/api/health';
        const reqId = `probe-${workerId}-${iteration}`;
        return {
          method: 'GET',
          url: `${ctx.config.serverUrl}${endpoint}`,
          headers: { 'x-request-id': reqId },
          validateBody: validateApiEnvelope,
        };
      },
    },
    {
      id: 'backend-ingest-logs',
      name: '后端服务日志批量写入链路 (/api/v1/ingest/logs)',
      category: 'backend-api',
      targetUrl: `${ctx.config.serverUrl}/api/v1/ingest/logs`,
      phases: profile.httpPhases,
      timeoutMs: profile.timeoutMs,
      sla: profile.sla.frontendSdk,
      nextRequest: (workerId, iteration) => ({
        method: 'POST',
        url: `${ctx.config.serverUrl}/api/v1/ingest/logs`,
        headers: {
          'content-type': 'application/json',
          'x-app-key': ctx.resolvedAppKey,
          ...(ctx.config.simulateIps
            ? { 'x-forwarded-for': randomSimulatedIp(workerId + 100, iteration) }
            : {}),
        },
        body: buildServerLogBatch(
          ctx.resolvedAppKey,
          Math.max(5, Math.min(40, profile.sdkBatchSize)),
          workerId,
          iteration,
        ),
        allowRateLimit: true,
        validateBody: validateApiEnvelope,
      }),
    },
  ];

  if (ctx.accessToken) {
    const authHeader = { authorization: `Bearer ${ctx.accessToken}` };

    scenarios.push({
      id: 'backend-auth-users',
      name: '后端鉴权与会话读取链路 (/admin/auth/me · /users · /admin/auth/refresh · /admin/auth/login)',
      category: 'backend-api',
      targetUrl: `${ctx.config.serverUrl}/api/v1/admin/auth/me`,
      phases: profile.httpPhases,
      timeoutMs: profile.timeoutMs,
      sla: profile.sla.backendApi,
      nextRequest: (_workerId, iteration): HttpRequestSpec => {
        const slot = iteration % 20;
        if (slot === 0) {
          return {
            method: 'POST',
            url: `${ctx.config.serverUrl}/api/v1/admin/auth/login`,
            headers: { 'content-type': 'application/json', 'accept-language': 'zh-CN' },
            body: JSON.stringify({
              email: ctx.config.adminEmail,
              password: ctx.config.adminPassword,
            }),
            validateBody: validateApiEnvelope,
          };
        }
        if (slot <= 2 && ctx.refreshCookie) {
          return {
            method: 'POST',
            url: `${ctx.config.serverUrl}/api/v1/admin/auth/refresh`,
            headers: { cookie: ctx.refreshCookie },
            validateBody: validateApiEnvelope,
          };
        }
        if (slot <= 7) {
          return {
            method: 'GET',
            url: `${ctx.config.serverUrl}/api/v1/users?page=1&limit=10`,
            headers: authHeader,
            validateBody: validateApiEnvelope,
          };
        }
        return {
          method: 'GET',
          url: `${ctx.config.serverUrl}/api/v1/admin/auth/me`,
          headers: authHeader,
          validateBody: validateApiEnvelope,
        };
      },
    });

    scenarios.push({
      id: 'backend-monitor-queries',
      name: '后端监控分析与聚合查询链路 (/analytics/* · /events · /errors · /logs · /ips)',
      category: 'backend-api',
      targetUrl: `${ctx.config.serverUrl}/api/v1/analytics/overview`,
      phases: profile.httpPhases,
      timeoutMs: profile.timeoutMs,
      sla: profile.sla.backendApi,
      nextRequest: (workerId, iteration) => {
        const queryPath =
          MONITOR_QUERY_PATHS[(workerId * 3 + iteration) % MONITOR_QUERY_PATHS.length]!;
        return {
          method: 'GET',
          url: `${ctx.config.serverUrl}${queryPath}`,
          headers: {
            ...authHeader,
            'accept-language': 'zh-CN',
          },
          validateBody: validateApiEnvelope,
        };
      },
    });
  }

  return scenarios;
}

export function buildMixedRealisticScenario(
  ctx: RuntimeContext,
  profile: LoadProfile,
): HttpScenarioDefinition | null {
  if (!ctx.reachability.server.reachable && !ctx.reachability.web.reachable) {
    return null;
  }

  return {
    id: 'mixed-realistic-traffic',
    name: '全栈真实混合业务流量 (45% 前端访问 + 30% SDK 上报 + 15% 监控大盘 + 10% 鉴权探针)',
    category: 'mixed',
    targetUrl: `${ctx.config.webUrl} + ${ctx.config.serverUrl}`,
    phases: profile.httpPhases,
    timeoutMs: profile.timeoutMs,
    sla: profile.sla.backendApi,
    nextRequest: (workerId, iteration): HttpRequestSpec => {
      const bucket = (workerId * 11 + iteration) % 20;

      // 45% 前端页面与资源请求（若 web 可达）
      if (bucket < 9 && ctx.reachability.web.reachable) {
        const routes = ['/', '/flagship', '/store', '/academy', ...ctx.webAssetPaths];
        const path = routes[(workerId + iteration) % routes.length] ?? '/';
        return {
          method: 'GET',
          url: `${ctx.config.webUrl}${path}`,
          allowRateLimit: true,
        };
      }

      // 30% 前端 SDK 批量上报（若 server 可达）
      if (bucket < 15 && ctx.reachability.server.reachable) {
        return {
          method: 'POST',
          url: `${ctx.config.serverUrl}/api/v1/ingest/events`,
          headers: {
            'content-type': 'application/json',
            'x-app-key': ctx.resolvedAppKey,
            ...(ctx.config.simulateIps
              ? { 'x-forwarded-for': randomSimulatedIp(workerId, iteration) }
              : {}),
          },
          body: buildSdkEventBatch(
            ctx.resolvedAppKey,
            Math.max(3, Math.min(15, profile.sdkBatchSize)),
            workerId,
            iteration,
            false,
          ),
          allowRateLimit: true,
          validateBody: validateApiEnvelope,
        };
      }

      // 15% 管理端监控统计查询
      if (bucket < 18 && ctx.reachability.server.reachable && ctx.accessToken) {
        const queryPath = MONITOR_QUERY_PATHS[(workerId + iteration) % MONITOR_QUERY_PATHS.length]!;
        return {
          method: 'GET',
          url: `${ctx.config.serverUrl}${queryPath}`,
          headers: { authorization: `Bearer ${ctx.accessToken}` },
          validateBody: validateApiEnvelope,
        };
      }

      // 10% 鉴权与健康检查
      if (ctx.reachability.server.reachable) {
        if (ctx.accessToken && iteration % 2 === 0) {
          return {
            method: 'GET',
            url: `${ctx.config.serverUrl}/api/v1/admin/auth/me`,
            headers: { authorization: `Bearer ${ctx.accessToken}` },
            validateBody: validateApiEnvelope,
          };
        }
        return {
          method: 'GET',
          url: `${ctx.config.serverUrl}/api/health`,
          validateBody: validateApiEnvelope,
        };
      }

      return {
        method: 'GET',
        url: `${ctx.config.webUrl}/`,
      };
    },
  };
}
