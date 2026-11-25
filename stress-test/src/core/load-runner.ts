import { performance } from 'node:perf_hooks';
import type {
  HttpRequestSpec,
  HttpSample,
  HttpScenarioResult,
  LoadPhase,
  ScenarioCategory,
  SlaThreshold,
} from '../config/types';
import { HttpLoadClient } from './http-client';
import { buildTimeline, evaluateHttpSla, round, summarizeLatencies } from './stats';

export interface HttpScenarioDefinition {
  id: string;
  name: string;
  category: ScenarioCategory;
  targetUrl: string;
  phases: LoadPhase[];
  timeoutMs: number;
  sla: SlaThreshold;
  nextRequest: (workerId: number, iteration: number) => HttpRequestSpec;
}

export interface LiveProgressSnapshot {
  scenarioId: string;
  scenarioName: string;
  phaseName: string;
  concurrency: number;
  elapsedSec: number;
  totalDurationSec: number;
  completedRequests: number;
  recentRps: number;
  errorCount: number;
  rateLimitedCount: number;
}

export async function runHttpScenario(
  def: HttpScenarioDefinition,
  options?: {
    client?: HttpLoadClient;
    onProgress?: (snapshot: LiveProgressSnapshot) => void;
  },
): Promise<HttpScenarioResult> {
  const peakConcurrency = Math.max(1, ...def.phases.map((p) => p.concurrency));
  const ownClient = !options?.client;
  const client = options?.client ?? new HttpLoadClient(Math.max(64, peakConcurrency * 2));

  const startedAtDate = new Date();
  const startedWallMs = startedAtDate.getTime();
  const startedPerf = performance.now();
  const totalPlannedSec = def.phases.reduce((sum, p) => sum + p.durationSec, 0);

  const samples: HttpSample[] = [];
  const statusCounts: Record<string, number> = {};
  const errorReasons: Record<string, number> = {};

  let targetConcurrency = 0;
  let currentPhaseName = def.phases[0]?.name ?? 'run';
  let stopping = false;
  let nextWorkerId = 0;
  let lastProgressCount = 0;
  let errorCount = 0;
  let rateLimitedCount = 0;
  const activeWorkers = new Set<Promise<void>>();

  const spawnWorker = () => {
    const workerId = nextWorkerId++;
    let iteration = 0;
    const loop = (async () => {
      while (!stopping && activeWorkers.size <= targetConcurrency) {
        const spec = def.nextRequest(workerId, iteration++);
        const sample = await client.send(spec, def.timeoutMs);
        samples.push(sample);
        const statusKey = sample.status > 0 ? String(sample.status) : 'ERR';
        statusCounts[statusKey] = (statusCounts[statusKey] ?? 0) + 1;
        if (sample.rateLimited) {
          rateLimitedCount += 1;
        } else if (!sample.ok) {
          errorCount += 1;
          const reason = sample.errorReason ?? `HTTP_${sample.status}`;
          errorReasons[reason] = (errorReasons[reason] ?? 0) + 1;
        }
        if (activeWorkers.size > targetConcurrency) {
          break;
        }
      }
    })().finally(() => {
      activeWorkers.delete(loop);
    });
    activeWorkers.add(loop);
  };

  const adjustPool = (desired: number) => {
    targetConcurrency = desired;
    while (!stopping && activeWorkers.size < targetConcurrency) {
      spawnWorker();
    }
  };

  const progressTimer = options?.onProgress
    ? setInterval(() => {
        const currentTotal = samples.length;
        const delta = currentTotal - lastProgressCount;
        lastProgressCount = currentTotal;
        options.onProgress?.({
          scenarioId: def.id,
          scenarioName: def.name,
          phaseName: currentPhaseName,
          concurrency: targetConcurrency,
          elapsedSec: round((performance.now() - startedPerf) / 1000, 1),
          totalDurationSec: totalPlannedSec,
          completedRequests: currentTotal,
          recentRps: delta,
          errorCount,
          rateLimitedCount,
        });
      }, 1000)
    : null;

  try {
    for (const phase of def.phases) {
      currentPhaseName = phase.name;
      adjustPool(phase.concurrency);
      await sleep(phase.durationSec * 1000);
    }
    stopping = true;
    targetConcurrency = 0;
    await Promise.allSettled([...activeWorkers]);
  } finally {
    if (progressTimer) clearInterval(progressTimer);
    if (ownClient) client.destroy();
  }

  const finishedAtDate = new Date();
  const durationSec = Math.max(0.05, round((performance.now() - startedPerf) / 1000, 2));
  const totalRequests = samples.length;
  const okRequests = samples.filter((s) => s.ok && !s.rateLimited).length;
  const failedRequests = samples.filter((s) => !s.ok).length;
  const totalBytes = samples.reduce((acc, s) => acc + s.bytes, 0);
  const errorRate = totalRequests > 0 ? round(failedRequests / totalRequests, 4) : 0;
  const rps = round(totalRequests / durationSec, 2);
  const throughputBytesPerSec = Math.round(totalBytes / durationSec);

  const latencyMs = summarizeLatencies(samples.map((s) => s.durationMs));
  const ttfbMs = summarizeLatencies(samples.filter((s) => s.ttfbMs > 0).map((s) => s.ttfbMs));
  const timeline = buildTimeline(samples, startedWallMs, durationSec);
  const sla = evaluateHttpSla({ errorRate, latencyMs, rps }, def.sla);

  return {
    kind: 'http',
    id: def.id,
    name: def.name,
    category: def.category,
    targetUrl: def.targetUrl,
    startedAt: startedAtDate.toISOString(),
    finishedAt: finishedAtDate.toISOString(),
    durationSec,
    peakConcurrency,
    totalRequests,
    okRequests,
    rateLimitedRequests: rateLimitedCount,
    failedRequests,
    errorRate,
    rps,
    throughputBytesPerSec,
    totalBytes,
    latencyMs,
    ttfbMs,
    statusCounts,
    errorReasons,
    timeline,
    sla,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
