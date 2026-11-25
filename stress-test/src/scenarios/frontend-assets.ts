import type { LoadProfile } from '../config/types';
import type { RuntimeContext } from '../core/context';
import type { HttpScenarioDefinition } from '../core/load-runner';

const WEB_SPA_ROUTES = [
  '/',
  '/flagship',
  '/academy',
  '/community',
  '/store',
  '/login',
  '/register',
];

const ADMIN_SPA_ROUTES = [
  '/login',
  '/',
  '/traffic',
  '/events',
  '/errors',
  '/logs',
  '/ips',
  '/projects',
];

export function buildFrontendAssetScenarios(
  ctx: RuntimeContext,
  profile: LoadProfile,
): HttpScenarioDefinition[] {
  const scenarios: HttpScenarioDefinition[] = [];

  if (ctx.reachability.web.reachable) {
    const webTargets = [...WEB_SPA_ROUTES, ...ctx.webAssetPaths];
    scenarios.push({
      id: 'frontend-web-assets',
      name: '前台官网 (Web) 页面与静态资源并发吞吐',
      category: 'frontend-assets',
      targetUrl: ctx.config.webUrl,
      phases: profile.httpPhases,
      timeoutMs: profile.timeoutMs,
      sla: profile.sla.frontendAssets,
      nextRequest: (workerId, iteration) => {
        const path = webTargets[(workerId * 7 + iteration) % webTargets.length] ?? '/';
        const isSpaRoute = WEB_SPA_ROUTES.includes(path);
        return {
          method: 'GET',
          url: `${ctx.config.webUrl}${path}`,
          headers: {
            accept: isSpaRoute
              ? 'text/html,application/xhtml+xml'
              : '*/*',
            'accept-encoding': 'gzip, deflate',
            'user-agent': 'AeroApex-StressTest/0.1 (FrontendAssets)',
          },
          allowRateLimit: true,
          validateBody: isSpaRoute
            ? (_status, text) =>
                text.includes('<html') || text.includes('<!doctype html') || text.includes('<div')
                  ? null
                  : 'INVALID_HTML_DOCUMENT'
            : undefined,
        };
      },
    });
  }

  if (ctx.reachability.admin.reachable) {
    const adminTargets = [...ADMIN_SPA_ROUTES, ...ctx.adminAssetPaths];
    scenarios.push({
      id: 'frontend-admin-assets',
      name: '管理后台 (Admin) 页面与静态资源并发吞吐',
      category: 'frontend-assets',
      targetUrl: ctx.config.adminUrl,
      phases: profile.httpPhases,
      timeoutMs: profile.timeoutMs,
      sla: profile.sla.frontendAssets,
      nextRequest: (workerId, iteration) => {
        const path = adminTargets[(workerId * 5 + iteration) % adminTargets.length] ?? '/login';
        const isSpaRoute = ADMIN_SPA_ROUTES.includes(path);
        return {
          method: 'GET',
          url: `${ctx.config.adminUrl}${path}`,
          headers: {
            accept: isSpaRoute
              ? 'text/html,application/xhtml+xml'
              : '*/*',
            'accept-encoding': 'gzip, deflate',
            'user-agent': 'AeroApex-StressTest/0.1 (AdminAssets)',
          },
          allowRateLimit: true,
          validateBody: isSpaRoute
            ? (_status, text) =>
                text.includes('<html') || text.includes('<!doctype html') || text.includes('<div')
                  ? null
                  : 'INVALID_HTML_DOCUMENT'
            : undefined,
        };
      },
    });
  }

  return scenarios;
}
