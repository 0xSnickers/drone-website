import { performance } from 'node:perf_hooks';
import { createCdpDriver } from '../browser/cdp-driver';
import { createPlaywrightDriver } from '../browser/playwright-driver';
import type { BrowserDriver, BrowserDriverOptions } from '../browser/types';
import type {
  BrowserPageSample,
  BrowserScenarioResult,
  LoadProfile,
} from '../config/types';
import type { RuntimeContext } from '../core/context';
import { evaluateBrowserSla, round, summarizeLatencies } from '../core/stats';

export interface BrowserScenarioPlan {
  id: string;
  name: string;
  baseUrl: string;
  routes: string[];
  interactionMode: 'web-showcase' | 'admin-console';
  credentials?: { email: string; password: string };
}

export async function resolveBrowserDriver(
  options: BrowserDriverOptions,
): Promise<{ driver: BrowserDriver | null; skippedReason?: string }> {
  if (options.driverPreference === 'playwright') {
    try {
      return {
        driver: await createPlaywrightDriver({
          headless: options.headless,
          chromeBin: options.chromeBin,
        }),
      };
    } catch (err) {
      return {
        driver: null,
        skippedReason: `Playwright 启动失败（可执行 npm i -D playwright && npx playwright install chromium）: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (options.driverPreference === 'cdp') {
    try {
      return {
        driver: await createCdpDriver({
          headless: options.headless,
          chromeBin: options.chromeBin,
        }),
      };
    } catch (err) {
      return {
        driver: null,
        skippedReason: `原生 CDP 驱动未找到可用浏览器（可通过 STRESS_CHROME_BIN 指定路径）: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // auto：优先尝试 Playwright，未安装时无缝回退至零依赖 CDP 驱动
  try {
    return {
      driver: await createPlaywrightDriver({
        headless: options.headless,
        chromeBin: options.chromeBin,
      }),
    };
  } catch {
    try {
      return {
        driver: await createCdpDriver({
          headless: options.headless,
          chromeBin: options.chromeBin,
        }),
      };
    } catch (cdpErr) {
      return {
        driver: null,
        skippedReason: `当前环境未检测到可用的 Headless 浏览器（Playwright 未安装且系统 Chrome 不可访问: ${cdpErr instanceof Error ? cdpErr.message : String(cdpErr)}）`,
      };
    }
  }
}

export function buildBrowserScenarioPlans(ctx: RuntimeContext): BrowserScenarioPlan[] {
  const plans: BrowserScenarioPlan[] = [];

  if (ctx.reachability.web.reachable) {
    plans.push({
      id: 'frontend-web-browser',
      name: '前台官网 (Web) 真实浏览器渲染与高频交互压测',
      baseUrl: ctx.config.webUrl,
      routes: ['/', '/flagship', '/academy', '/community', '/store', '/login'],
      interactionMode: 'web-showcase',
    });
  }

  if (ctx.reachability.admin.reachable) {
    plans.push({
      id: 'frontend-admin-browser',
      name: '管理后台 (Admin) 真实浏览器渲染与表单交互压测',
      baseUrl: ctx.config.adminUrl,
      routes: ['/login', '/register', '/'],
      interactionMode: 'admin-console',
      credentials: {
        email: ctx.config.adminEmail,
        password: ctx.config.adminPassword,
      },
    });
  }

  return plans;
}

export async function runBrowserScenarioWithDriver(
  plan: BrowserScenarioPlan,
  profile: LoadProfile,
  driver: BrowserDriver | null,
  skippedReason?: string,
): Promise<BrowserScenarioResult> {
  const startedAt = new Date().toISOString();

  if (!driver) {
    const emptyLatency = summarizeLatencies([]);
    return {
      kind: 'browser',
      id: plan.id,
      name: plan.name,
      category: 'frontend-browser',
      driverUsed: 'skipped',
      targetUrl: plan.baseUrl,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationSec: 0,
      concurrency: profile.browserConcurrency,
      totalNavigations: 0,
      okNavigations: 0,
      failedNavigations: 0,
      errorRate: 0,
      totalJsErrors: 0,
      jsErrorSamples: [],
      skippedReason: skippedReason ?? '未配置可用浏览器驱动',
      metrics: {
        navigationMs: emptyLatency,
        ttfbMs: emptyLatency,
        fcpMs: emptyLatency,
        lcpMs: emptyLatency,
        loadEventMs: emptyLatency,
        interactionMs: emptyLatency,
        peakJsHeapMb: 0,
        avgDomNodes: 0,
      },
      routeBreakdown: [],
      sla: {
        passed: true,
        checks: [
          {
            metric: '浏览器环境探测',
            actual: 'SKIPPED',
            target: 'Playwright 或 Chrome/Chromium',
            passed: true,
          },
        ],
      },
    };
  }

  const startedPerf = performance.now();
  const samples: BrowserPageSample[] = [];
  const concurrency = Math.max(1, profile.browserConcurrency);
  const totalLoops = Math.max(1, profile.browserIterationsPerWorker) * plan.routes.length;

  await Promise.all(
    Array.from({ length: concurrency }, async (_, workerIdx) => {
      for (let step = 0; step < totalLoops; step++) {
        const route = plan.routes[(workerIdx + step) % plan.routes.length] ?? '/';
        const sample = await driver.visitAndInteract({
          baseUrl: plan.baseUrl,
          route,
          timeoutMs: Math.max(8000, profile.timeoutMs * 2),
          interactionMode: plan.interactionMode,
          credentials: plan.credentials,
        });
        samples.push(sample);
      }
    }),
  );

  const durationSec = Math.max(0.05, round((performance.now() - startedPerf) / 1000, 2));
  const okSamples = samples.filter((s) => s.ok);
  const failedNavigations = samples.length - okSamples.length;
  const errorRate = samples.length > 0 ? round(failedNavigations / samples.length, 4) : 0;
  const allJsErrors = samples.flatMap((s) => s.jsErrors);

  const navigationMs = summarizeLatencies(okSamples.map((s) => s.navigationMs));
  const ttfbMs = summarizeLatencies(okSamples.map((s) => s.ttfbMs));
  const fcpMs = summarizeLatencies(okSamples.map((s) => s.fcpMs));
  const lcpMs = summarizeLatencies(okSamples.map((s) => s.lcpMs));
  const loadEventMs = summarizeLatencies(okSamples.map((s) => s.loadEventMs));
  const interactionMs = summarizeLatencies(okSamples.map((s) => s.interactionMs));
  const peakJsHeapMb = round(Math.max(0, ...okSamples.map((s) => s.jsHeapUsedMb)), 2);
  const avgDomNodes =
    okSamples.length > 0
      ? Math.round(okSamples.reduce((acc, s) => acc + s.domNodes, 0) / okSamples.length)
      : 0;

  const routeBreakdown = plan.routes.map((route) => {
    const routeSamples = samples.filter((s) => s.route === route);
    const okRoute = routeSamples.filter((s) => s.ok);
    const fcpSummary = summarizeLatencies(okRoute.map((s) => s.fcpMs));
    const loadSummary = summarizeLatencies(okRoute.map((s) => s.loadEventMs));
    return {
      route,
      count: routeSamples.length,
      avgFcpMs: fcpSummary.avg,
      p95LoadMs: loadSummary.p95,
      jsErrors: routeSamples.reduce((sum, s) => sum + s.jsErrors.length, 0),
    };
  });

  const sla = evaluateBrowserSla(
    {
      errorRate,
      fcpP95Ms: fcpMs.p95,
      loadP95Ms: loadEventMs.p95,
      totalJsErrors: allJsErrors.length,
    },
    profile.sla.browserRender,
  );

  return {
    kind: 'browser',
    id: plan.id,
    name: plan.name,
    category: 'frontend-browser',
    driverUsed: driver.name,
    targetUrl: plan.baseUrl,
    startedAt,
    finishedAt: new Date().toISOString(),
    durationSec,
    concurrency,
    totalNavigations: samples.length,
    okNavigations: okSamples.length,
    failedNavigations,
    errorRate,
    totalJsErrors: allJsErrors.length,
    jsErrorSamples: [...new Set(allJsErrors)].slice(0, 5),
    metrics: {
      navigationMs,
      ttfbMs,
      fcpMs,
      lcpMs,
      loadEventMs,
      interactionMs,
      peakJsHeapMb,
      avgDomNodes,
    },
    routeBreakdown,
    sla,
  };
}
