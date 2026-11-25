import os from 'node:os';
import { performance } from 'node:perf_hooks';
import type {
  LoadProfile,
  ScenarioResult,
  StressEnvConfig,
  StressRunReport,
  SuiteName,
} from '../config/types';
import {
  PreFlightError,
  prepareRuntimeContext,
  validatePreFlightContext,
  type PreFlightIssue,
  type RuntimeContext,
} from '../core/context';
import { HttpLoadClient } from '../core/http-client';
import {
  runHttpScenario,
  type HttpScenarioDefinition,
  type LiveProgressSnapshot,
} from '../core/load-runner';
import { diagnoseBottlenecks, round } from '../core/stats';
import { buildBackendApiScenarios, buildMixedRealisticScenario } from './backend-api';
import { buildFrontendAssetScenarios } from './frontend-assets';
import {
  buildBrowserScenarioPlans,
  resolveBrowserDriver,
  runBrowserScenarioWithDriver,
  type BrowserScenarioPlan,
} from './frontend-browser';
import { buildFrontendSdkScenarios } from './frontend-sdk';

export interface ExecutionPlan {
  httpScenarios: HttpScenarioDefinition[];
  browserPlans: BrowserScenarioPlan[];
}

export function buildExecutionPlan(
  ctx: RuntimeContext,
  profile: LoadProfile,
  suite: SuiteName,
): ExecutionPlan {
  const httpScenarios: HttpScenarioDefinition[] = [];
  let browserPlans: BrowserScenarioPlan[] = [];

  if (suite === 'all' || suite === 'frontend' || suite === 'assets') {
    httpScenarios.push(...buildFrontendAssetScenarios(ctx, profile));
  }
  if (suite === 'all' || suite === 'frontend' || suite === 'sdk') {
    httpScenarios.push(...buildFrontendSdkScenarios(ctx, profile));
  }
  if (suite === 'all' || suite === 'frontend' || suite === 'browser') {
    browserPlans = buildBrowserScenarioPlans(ctx);
  }
  if (suite === 'all' || suite === 'backend' || suite === 'api') {
    httpScenarios.push(...buildBackendApiScenarios(ctx, profile));
  }
  if (suite === 'all' || suite === 'mixed') {
    const mixed = buildMixedRealisticScenario(ctx, profile);
    if (mixed) httpScenarios.push(mixed);
  }

  return { httpScenarios, browserPlans };
}

export interface RunStressSuiteHooks {
  onContextReady?: (ctx: RuntimeContext, plan: ExecutionPlan, issues: PreFlightIssue[]) => void;
  onScenarioStart?: (index: number, total: number, title: string) => void;
  onHttpProgress?: (snapshot: LiveProgressSnapshot) => void;
  onScenarioComplete?: (result: ScenarioResult) => void;
}

export async function executeStressSuite(
  config: StressEnvConfig,
  profile: LoadProfile,
  hooks?: RunStressSuiteHooks,
): Promise<StressRunReport> {
  const startedPerf = performance.now();
  const ctx = await prepareRuntimeContext(config);
  const issues = validatePreFlightContext(ctx, config.suite);
  const plan = buildExecutionPlan(ctx, profile, config.suite);
  hooks?.onContextReady?.(ctx, plan, issues);

  if (issues.length > 0 && !config.allowPartial) {
    throw new PreFlightError(issues);
  }

  const totalCount = plan.httpScenarios.length + plan.browserPlans.length;
  const results: ScenarioResult[] = [];
  let currentIdx = 0;

  const peakSockets = Math.max(64, ...profile.httpPhases.map((p) => p.concurrency * 2));
  const sharedClient = new HttpLoadClient(peakSockets);

  try {
    for (const scenario of plan.httpScenarios) {
      currentIdx += 1;
      hooks?.onScenarioStart?.(currentIdx, totalCount, scenario.name);
      const res = await runHttpScenario(scenario, {
        client: sharedClient,
        onProgress: hooks?.onHttpProgress,
      });
      results.push(res);
      hooks?.onScenarioComplete?.(res);
    }
  } finally {
    sharedClient.destroy();
  }

  if (plan.browserPlans.length > 0) {
    const { driver, skippedReason } = await resolveBrowserDriver({
      driverPreference: config.browserDriver,
      chromeBin: config.chromeBin || undefined,
      headless: config.headless,
    });

    try {
      for (const bPlan of plan.browserPlans) {
        currentIdx += 1;
        hooks?.onScenarioStart?.(currentIdx, totalCount, bPlan.name);
        const res = await runBrowserScenarioWithDriver(bPlan, profile, driver, skippedReason);
        results.push(res);
        hooks?.onScenarioComplete?.(res);
      }
    } finally {
      if (driver) {
        await driver.close();
      }
    }
  }

  const totalDurationSec = round((performance.now() - startedPerf) / 1000, 2);
  const httpResults = results.filter((r) => r.kind === 'http');
  const browserResults = results.filter((r) => r.kind === 'browser');

  const totalHttpRequests = httpResults.reduce((acc, r) => acc + r.totalRequests, 0);
  const totalHttpFailed = httpResults.reduce((acc, r) => acc + r.failedRequests, 0);
  const totalHttpDuration = httpResults.reduce((acc, r) => acc + r.durationSec, 0);
  const skippedScenarios = browserResults.filter((r) => r.driverUsed === 'skipped').length;
  const passedScenarios = results.filter(
    (r) => !(r.kind === 'browser' && r.driverUsed === 'skipped') && r.sla.passed,
  ).length;
  const failedScenarios = results.length - passedScenarios - skippedScenarios;

  return {
    runId: `stress-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`,
    generatedAt: new Date().toISOString(),
    durationSec: totalDurationSec,
    profile,
    suite: config.suite,
    simulateIps: config.simulateIps,
    environment: {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      cpuCount: os.cpus().length,
    },
    reachability: ctx.reachability,
    results,
    summary: {
      totalScenarios: results.length,
      passedScenarios,
      failedScenarios,
      skippedScenarios,
      totalHttpRequests,
      overallHttpRps: totalHttpDuration > 0 ? round(totalHttpRequests / totalHttpDuration, 2) : 0,
      overallHttpErrorRate:
        totalHttpRequests > 0 ? round(totalHttpFailed / totalHttpRequests, 4) : 0,
      totalBrowserNavigations: browserResults.reduce((acc, r) => acc + r.totalNavigations, 0),
      overallPassed: results.length > 0 && failedScenarios === 0,
    },
    bottlenecks: diagnoseBottlenecks(results),
  };
}
