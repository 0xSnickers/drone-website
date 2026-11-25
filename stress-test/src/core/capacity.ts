import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { StressEnvConfig } from '../config/types';
import { PreFlightError, prepareRuntimeContext, validatePreFlightContext } from './context';
import { clearStressHeartbeat, writeStressHeartbeat } from './heartbeat';
import { HttpLoadClient } from './http-client';
import { runHttpScenario, type HttpScenarioDefinition } from './load-runner';
import { round } from './stats';
import { buildFrontendAssetScenarios } from '../scenarios/frontend-assets';
import { buildMixedRealisticScenario } from '../scenarios/backend-api';

export type StepHealthZone = 'healthy' | 'degraded' | 'overloaded';

export interface CapacityStepMetric {
  concurrency: number;
  rps: number;
  successRps: number;
  totalRequests: number;
  okRequests: number;
  rateLimitedRequests: number;
  failedRequests: number;
  errorRate: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  cpuBusyPct: number;
  loadAvg1m: number;
  memUsedGb: number;
  memTotalGb: number;
  zone: StepHealthZone;
}

export interface UserCapacityEstimate {
  /** 安全最大压测并发数 (零思考时间连续请求 VUs) */
  maxHealthyVus: number;
  /** 安全最大吞吐率 (req/s) */
  maxHealthyRps: number;
  /** 极限压测并发拐点 (包含轻度降级区) */
  peakUsableVus: number;
  /** 极限吞吐峰值 (req/s) */
  peakUsableRps: number;
  /** 正常同时在线用户数区间 (按单用户平均 4s ~ 8s 触发一次请求换算) */
  concurrentOnlineUsersRange: [number, number];
  /** 推荐日常稳定同时在线用户数 (按 6s 思考间隔换算) */
  recommendedOnlineUsers: number;
  /** 推荐可支撑日活跃用户数 DAU (按日均 30 次请求、晚高峰集中系数 4.0 换算) */
  recommendedDau: number;
}

export interface CapacityBenchmarkReport {
  generatedAt: string;
  targetMode: 'mixed' | 'frontend-only';
  stepDurationSec: number;
  hostSpec: {
    measurementSource: 'load-generator';
    cpuModel: string;
    cpuCores: number;
    totalMemGb: number;
  };
  steps: CapacityStepMetric[];
  estimate: UserCapacityEstimate;
}

interface CpuSnapshot {
  idle: number;
  total: number;
}

function readCpuSnapshot(): CpuSnapshot {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.irq + t.idle;
  }
  return { idle, total };
}

function computeCpuBusyPct(before: CpuSnapshot, after: CpuSnapshot): number {
  const totalDelta = after.total - before.total;
  const idleDelta = after.idle - before.idle;
  if (totalDelta <= 0) return 0;
  return round(Math.max(0, Math.min(100, ((totalDelta - idleDelta) / totalDelta) * 100)), 1);
}

export function classifyCapacityStep(metric: {
  errorRate: number;
  p95Ms: number;
  totalRequests: number;
  okRequests: number;
  rateLimitedRequests: number;
}): StepHealthZone {
  if (
    !metric.okRequests ||
    metric.totalRequests <= 0 ||
    metric.rateLimitedRequests / metric.totalRequests > 0.01
  )
    return 'overloaded';
  if (metric.errorRate === 0 && metric.okRequests === metric.totalRequests && metric.p95Ms <= 500)
    return 'healthy';
  if (metric.errorRate <= 0.01 && metric.p95Ms <= 1500) return 'degraded';
  return 'overloaded';
}

export function estimateUserCapacity(steps: CapacityStepMetric[]): UserCapacityEstimate {
  const healthySteps = steps.filter((s) => classifyCapacityStep(s) === 'healthy');
  const usableSteps = steps.filter((s) => classifyCapacityStep(s) !== 'overloaded');

  const bestHealthy = healthySteps.sort((a, b) => b.successRps - a.successRps)[0] ?? null;

  const bestUsable = usableSteps.sort((a, b) => b.successRps - a.successRps)[0] ?? null;

  const maxHealthyVus = bestHealthy
    ? Math.max(...healthySteps.map((s) => s.concurrency), bestHealthy.concurrency)
    : 0;
  const maxHealthyRps = bestHealthy ? bestHealthy.successRps : 0;
  const peakUsableVus = bestUsable
    ? Math.max(...usableSteps.map((s) => s.concurrency), bestUsable.concurrency)
    : 0;
  const peakUsableRps = bestUsable ? bestUsable.successRps : 0;

  // 真实在线用户平均每 4~8 秒产生 1 次有效请求（标准均值 6 秒，预留 20% 安全余量取 0.8 系数）
  const safeRps = maxHealthyRps > 0 ? maxHealthyRps * 0.8 : peakUsableRps * 0.6;
  const lowCcu = Math.round(safeRps * 4);
  const highCcu = Math.round(safeRps * 8);
  const recommendedOnlineUsers = Math.round(safeRps * 6);

  // DAU = (安全峰值 RPS * 86400) / (单用户日均请求数 30 * 晚高峰集中比 4.0)
  const recommendedDau = Math.round((safeRps * 86_400) / (30 * 4.0));

  return {
    maxHealthyVus,
    maxHealthyRps,
    peakUsableVus,
    peakUsableRps,
    concurrentOnlineUsersRange: [lowCcu, highCcu],
    recommendedOnlineUsers,
    recommendedDau,
  };
}

export async function runCapacityBenchmark(
  config: StressEnvConfig,
  options?: {
    targetMode?: 'mixed' | 'frontend-only';
    concurrencySteps?: number[];
    stepDurationSec?: number;
    onStepResult?: (step: CapacityStepMetric) => void;
  },
): Promise<CapacityBenchmarkReport> {
  const mode = options?.targetMode ?? 'mixed';
  const suiteForCheck = mode === 'frontend-only' ? 'assets' : 'mixed';
  const ctx = await prepareRuntimeContext(config);
  const issues = validatePreFlightContext(ctx, suiteForCheck);
  if (issues.length > 0 && !config.allowPartial) {
    throw new PreFlightError(issues);
  }

  const concurrencySteps =
    options?.concurrencySteps ??
    (mode === 'frontend-only' ? [50, 150, 300, 500] : [10, 25, 50, 100, 200, 300]);
  const stepDurationSec = options?.stepDurationSec ?? 4;

  const dummyProfile = {
    name: 'l1-baseline' as const,
    label: 'Capacity Step',
    description: 'Step-up capacity test',
    httpPhases: [{ name: 'step', durationSec: stepDurationSec, concurrency: 10 }],
    browserConcurrency: 1,
    browserIterationsPerWorker: 1,
    sdkBatchSize: 10,
    timeoutMs: 6000,
    sla: {
      frontendAssets: { maxErrorRate: 0.01, maxP95Ms: 500, maxP99Ms: 1000 },
      frontendSdk: { maxErrorRate: 0.01, maxP95Ms: 500, maxP99Ms: 1000 },
      backendApi: { maxErrorRate: 0.01, maxP95Ms: 500, maxP99Ms: 1000 },
      browserRender: { maxErrorRate: 0.02, maxFcpP95Ms: 2500, maxLoadP95Ms: 4500, maxJsErrors: 0 },
    },
  };

  let baseScenario: HttpScenarioDefinition | null = null;
  if (mode === 'frontend-only') {
    baseScenario = buildFrontendAssetScenarios(ctx, dummyProfile)[0] ?? null;
  } else {
    baseScenario = buildMixedRealisticScenario(ctx, dummyProfile);
  }
  if (!baseScenario) {
    throw new Error('无法构建容量阶梯压测场景，请检查目标服务状态');
  }

  const maxVus = Math.max(...concurrencySteps);
  const client = new HttpLoadClient(Math.max(128, maxVus * 2));
  const memTotalGb = round(os.totalmem() / 1024 ** 3, 2);
  const steps: CapacityStepMetric[] = [];
  const startedAtIso = new Date().toISOString();
  const runId = `capacity-${startedAtIso.replace(/[:.]/g, '-').slice(0, 19)}`;

  try {
    for (const vus of concurrencySteps) {
      writeStressHeartbeat(
        {
          active: true,
          runId,
          profile: 'capacity',
          suite: mode,
          currentScenario: `${baseScenario.name} (${vus} VUs)`,
          concurrency: vus,
          startedAt: startedAtIso,
          updatedAtMs: Date.now(),
        },
        config.reportDir,
      );
      const cpuBefore = readCpuSnapshot();
      const res = await runHttpScenario(
        {
          ...baseScenario,
          phases: [{ name: `step-${vus}vu`, durationSec: stepDurationSec, concurrency: vus }],
        },
        { client },
      );
      const cpuAfter = readCpuSnapshot();
      const cpuBusyPct = computeCpuBusyPct(cpuBefore, cpuAfter);
      const loadAvg1m = round(os.loadavg()[0] ?? 0, 2);
      const memUsedGb = round((os.totalmem() - os.freemem()) / 1024 ** 3, 2);
      const zone = classifyCapacityStep({
        errorRate: res.errorRate,
        p95Ms: res.successLatencyMs.p95,
        totalRequests: res.totalRequests,
        okRequests: res.okRequests,
        rateLimitedRequests: res.rateLimitedRequests,
      });

      const stepMetric: CapacityStepMetric = {
        concurrency: vus,
        rps: res.rps,
        successRps: res.successRps,
        totalRequests: res.totalRequests,
        okRequests: res.okRequests,
        rateLimitedRequests: res.rateLimitedRequests,
        failedRequests: res.failedRequests,
        errorRate: res.errorRate,
        p50Ms: res.successLatencyMs.p50,
        p95Ms: res.successLatencyMs.p95,
        p99Ms: res.successLatencyMs.p99,
        cpuBusyPct,
        loadAvg1m,
        memUsedGb,
        memTotalGb,
        zone,
      };
      steps.push(stepMetric);
      options?.onStepResult?.(stepMetric);
    }
  } finally {
    clearStressHeartbeat(config.reportDir);
    client.destroy();
  }

  const cpus = os.cpus();
  return {
    generatedAt: new Date().toISOString(),
    targetMode: mode,
    stepDurationSec,
    hostSpec: {
      measurementSource: 'load-generator',
      cpuModel: cpus[0]?.model.trim() ?? 'Unknown CPU',
      cpuCores: cpus.length,
      totalMemGb: memTotalGb,
    },
    steps,
    estimate: estimateUserCapacity(steps),
  };
}

export function saveCapacityReportJson(
  report: CapacityBenchmarkReport,
  reportDir: string,
  fileName = 'capacity-latest.json',
): string {
  fs.mkdirSync(reportDir, { recursive: true });
  const outPath = path.join(reportDir, fileName);
  fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + '\n', 'utf8');
  return outPath;
}
