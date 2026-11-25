import type { StressEnvConfig, SuiteName, TargetReachability } from '../config/types';
import { HttpLoadClient } from './http-client';

export interface PreFlightIssue {
  component: 'web' | 'admin' | 'server-health' | 'server-ready' | 'server-auth';
  url: string;
  reason: string;
  hint: string;
}

export class PreFlightError extends Error {
  constructor(public readonly issues: PreFlightIssue[]) {
    super(
      `压测前置环境检测未通过（共 ${issues.length} 项异常）：\n` +
        issues.map((i) => `  - [${i.component}] ${i.url}: ${i.reason}（${i.hint}）`).join('\n'),
    );
    this.name = 'PreFlightError';
  }
}

export interface RuntimeContext {
  config: StressEnvConfig;
  reachability: TargetReachability;
  accessToken: string | null;
  refreshCookie: string | null;
  resolvedAppKey: string;
  webAssetPaths: string[];
  adminAssetPaths: string[];
}

function validateJsonStatus(expectedFieldStatus: string) {
  return (_status: number, bodyText: string): string | null => {
    try {
      const parsed = JSON.parse(bodyText) as { code?: number; data?: { status?: string } };
      if (parsed.code !== 0) return `API_CODE_${String(parsed.code)}`;
      if (parsed.data?.status !== expectedFieldStatus) return `UNEXPECTED_STATUS`;
      return null;
    } catch {
      return 'INVALID_JSON';
    }
  };
}

export async function prepareRuntimeContext(config: StressEnvConfig): Promise<RuntimeContext> {
  const client = new HttpLoadClient(16);
  try {
    const [webProbe, adminProbe, healthProbe, readyProbe] = await Promise.all([
      probeHtmlAndAssets(client, config.webUrl),
      probeHtmlAndAssets(client, config.adminUrl),
      client.send({
        method: 'GET',
        url: `${config.serverUrl}/api/health`,
        timeoutMs: 3000,
        allowRateLimit: false,
        validateBody: validateJsonStatus('ok'),
      }),
      client.send({
        method: 'GET',
        url: `${config.serverUrl}/api/ready`,
        timeoutMs: 3000,
        allowRateLimit: false,
        validateBody: validateJsonStatus('ready'),
      }),
    ]);

    let accessToken: string | null = null;
    let refreshCookie: string | null = null;
    let resolvedAppKey = config.appKey;

    if (healthProbe.ok && readyProbe.ok) {
      const authResult = await loginDemoAdmin(
        config.serverUrl,
        config.adminEmail,
        config.adminPassword,
      );
      accessToken = authResult.accessToken;
      refreshCookie = authResult.refreshCookie;

      if (accessToken) {
        const discoveredKey = await fetchFirstProjectAppKey(config.serverUrl, accessToken);
        if (discoveredKey) resolvedAppKey = discoveredKey;
      }
    }

    return {
      config,
      reachability: {
        web: {
          url: config.webUrl,
          reachable: webProbe.reachable,
          status: webProbe.status,
          latencyMs: webProbe.latencyMs,
        },
        admin: {
          url: config.adminUrl,
          reachable: adminProbe.reachable,
          status: adminProbe.status,
          latencyMs: adminProbe.latencyMs,
        },
        server: {
          url: config.serverUrl,
          reachable: healthProbe.ok,
          ready: readyProbe.ok,
          authenticated: Boolean(accessToken),
          resolvedAppKey,
          latencyMs: healthProbe.durationMs,
        },
      },
      accessToken,
      refreshCookie,
      resolvedAppKey,
      webAssetPaths: webProbe.assetPaths,
      adminAssetPaths: adminProbe.assetPaths,
    };
  } finally {
    client.destroy();
  }
}

/**
 * 压测前强制校验当前选定套件所依赖的前后端服务是否全部在线且就绪。
 */
export function validatePreFlightContext(
  ctx: RuntimeContext,
  suite: SuiteName,
): PreFlightIssue[] {
  const issues: PreFlightIssue[] = [];
  const needWeb =
    suite === 'all' ||
    suite === 'frontend' ||
    suite === 'assets' ||
    suite === 'browser' ||
    suite === 'mixed';
  const needAdmin =
    suite === 'all' || suite === 'frontend' || suite === 'assets' || suite === 'browser';
  const needServer =
    suite === 'all' ||
    suite === 'frontend' ||
    suite === 'sdk' ||
    suite === 'backend' ||
    suite === 'api' ||
    suite === 'mixed';
  const needAuth =
    suite === 'all' || suite === 'backend' || suite === 'api' || suite === 'mixed';

  if (needWeb && !ctx.reachability.web.reachable) {
    issues.push({
      component: 'web',
      url: ctx.config.webUrl,
      reason: '前台官网未启动或未返回合法 HTML 页面',
      hint: '请先启动 Web 服务（如 cd web && npm run dev）或检查 --web-url',
    });
  }
  if (needAdmin && !ctx.reachability.admin.reachable) {
    issues.push({
      component: 'admin',
      url: ctx.config.adminUrl,
      reason: '管理后台未启动或未返回合法 HTML 页面',
      hint: '请先启动 Admin 服务（如 cd admin && npm run dev）或检查 --admin-url',
    });
  }
  if (needServer && !ctx.reachability.server.reachable) {
    issues.push({
      component: 'server-health',
      url: `${ctx.config.serverUrl}/api/health`,
      reason: '后端存活探针不可达',
      hint: '请先启动后端服务（如 cd server && ./scripts/dev.sh）或检查 --server-url',
    });
  } else if (needServer && !ctx.reachability.server.ready) {
    issues.push({
      component: 'server-ready',
      url: `${ctx.config.serverUrl}/api/ready`,
      reason: '后端数据库就绪探针失败 (HTTP 503 NOT_READY)',
      hint: '请检查后端数据库连接与迁移状态（cd server && ./scripts/db.sh migrate）',
    });
  } else if (needAuth && !ctx.reachability.server.authenticated) {
    issues.push({
      component: 'server-auth',
      url: `${ctx.config.serverUrl}/api/v1/auth/login`,
      reason: `压测账号 (${ctx.config.adminEmail}) 登录鉴权失败`,
      hint: '请确认后端开启 SEED_DEMO_USER=true 或配置正确的 STRESS_ADMIN_EMAIL / STRESS_ADMIN_PASSWORD',
    });
  }

  return issues;
}

async function probeHtmlAndAssets(client: HttpLoadClient, baseUrl: string) {
  let htmlBody = '';
  const sample = await client.send({
    method: 'GET',
    url: `${baseUrl}/`,
    timeoutMs: 3000,
    allowRateLimit: false,
    validateBody: (_status, text) => {
      htmlBody = text;
      return text.includes('<html') || text.includes('<!doctype html') || text.includes('<div')
        ? null
        : 'INVALID_HTML';
    },
  });

  if (!sample.ok) {
    return {
      reachable: false,
      status: sample.status || undefined,
      latencyMs: sample.durationMs,
      assetPaths: [] as string[],
    };
  }
  return {
    reachable: true,
    status: sample.status,
    latencyMs: sample.durationMs,
    assetPaths: extractLocalAssetPaths(htmlBody),
  };
}

export function extractLocalAssetPaths(html: string): string[] {
  const paths = new Set<string>();
  const attrRegex = /\b(?:src|href)=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(html)) !== null) {
    const raw = match[1]?.trim();
    if (!raw || raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) {
      continue;
    }
    paths.add(raw.startsWith('/') ? raw : `/${raw}`);
    if (paths.size >= 12) break;
  }
  return [...paths];
}

async function loginDemoAdmin(serverUrl: string, email: string, password: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${serverUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { accessToken: null, refreshCookie: null };

    const rawCookies = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie') ?? ''];
    const cookieLine = rawCookies.find((c) => c.startsWith('refresh_token='));
    const refreshCookie = cookieLine ? (cookieLine.split(';')[0] ?? null) : null;
    const json = (await res.json()) as { code?: number; data?: { accessToken?: string } };
    if (json.code === 0 && typeof json.data?.accessToken === 'string') {
      return { accessToken: json.data.accessToken, refreshCookie };
    }
    return { accessToken: null, refreshCookie: null };
  } catch {
    return { accessToken: null, refreshCookie: null };
  }
}

async function fetchFirstProjectAppKey(serverUrl: string, accessToken: string) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${serverUrl}/api/v1/projects?page=1&limit=5`, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: number;
      data?: { items?: Array<{ appKey?: string }> };
    };
    const firstKey = json.data?.items?.[0]?.appKey;
    return typeof firstKey === 'string' && firstKey.length > 0 ? firstKey : null;
  } catch {
    return null;
  }
}
