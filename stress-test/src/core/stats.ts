import type {
  HttpSample,
  LatencySummary,
  ScenarioResult,
  SlaEvaluation,
  SlaThreshold,
  TimeSeriesBucket,
} from '../config/types';

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return round(sortedValues[0] ?? 0);
  const rank = (p / 100) * (sortedValues.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const weight = rank - low;
  const lowVal = sortedValues[low] ?? 0;
  const highVal = sortedValues[high] ?? lowVal;
  return round(lowVal + (highVal - lowVal) * weight);
}

export function summarizeLatencies(values: number[]): LatencySummary {
  if (values.length === 0) {
    return { min: 0, avg: 0, p50: 0, p90: 0, p95: 0, p99: 0, max: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    min: round(sorted[0] ?? 0),
    avg: round(sum / sorted.length),
    p50: percentile(sorted, 50),
    p90: percentile(sorted, 90),
    p95: percentile(sorted, 95),
    p99: percentile(sorted, 99),
    max: round(sorted[sorted.length - 1] ?? 0),
  };
}

export function buildTimeline(
  samples: HttpSample[],
  startedMs: number,
  totalDurationSec: number,
): TimeSeriesBucket[] {
  const bucketCount = Math.max(1, Math.ceil(totalDurationSec));
  const buckets = Array.from({ length: bucketCount }, (_, idx) => ({
    secondOffset: idx + 1,
    timestampIso: new Date(startedMs + idx * 1000).toISOString(),
    requests: 0,
    okCount: 0,
    rateLimitedCount: 0,
    errorCount: 0,
    latencies: [] as number[],
  }));

  for (const s of samples) {
    const rawIdx = Math.floor((s.timestampMs - startedMs) / 1000);
    const idx = Math.max(0, Math.min(bucketCount - 1, rawIdx));
    const bucket = buckets[idx];
    if (!bucket) continue;
    bucket.requests += 1;
    bucket.latencies.push(s.durationMs);
    if (s.rateLimited) {
      bucket.rateLimitedCount += 1;
    } else if (s.ok) {
      bucket.okCount += 1;
    } else {
      bucket.errorCount += 1;
    }
  }

  return buckets.map((b) => {
    const sorted = b.latencies.sort((a, c) => a - c);
    return {
      secondOffset: b.secondOffset,
      timestampIso: b.timestampIso,
      requests: b.requests,
      okCount: b.okCount,
      rateLimitedCount: b.rateLimitedCount,
      errorCount: b.errorCount,
      rps: b.requests,
      p95Ms: percentile(sorted, 95),
    };
  });
}

export function evaluateHttpSla(
  metrics: {
    errorRate: number;
    latencyMs: LatencySummary;
    rps: number;
    rateLimitRate?: number;
    okRequests?: number;
  },
  sla: SlaThreshold,
): SlaEvaluation {
  const checks: SlaEvaluation['checks'] = [
    {
      metric: '限流拒绝率',
      actual: `${round((metrics.rateLimitRate ?? 0) * 100, 2)}%`,
      target: `<= ${round((sla.maxRateLimitRate ?? 0.01) * 100, 2)}%`,
      passed: (metrics.rateLimitRate ?? 0) <= (sla.maxRateLimitRate ?? 0.01),
    },
    {
      metric: '有效业务响应',
      actual: String(metrics.okRequests ?? '未单独统计'),
      target: '> 0',
      passed: metrics.okRequests === undefined || metrics.okRequests > 0,
    },
    {
      metric: '错误率 (Error Rate)',
      actual: `${round(metrics.errorRate * 100, 2)}%`,
      target: `<= ${round(sla.maxErrorRate * 100, 2)}%`,
      passed: metrics.errorRate <= sla.maxErrorRate,
    },
    {
      metric: 'P95 延迟',
      actual: `${metrics.latencyMs.p95} ms`,
      target: `<= ${sla.maxP95Ms} ms`,
      passed: metrics.latencyMs.p95 <= sla.maxP95Ms,
    },
    {
      metric: 'P99 延迟',
      actual: `${metrics.latencyMs.p99} ms`,
      target: `<= ${sla.maxP99Ms} ms`,
      passed: metrics.latencyMs.p99 <= sla.maxP99Ms,
    },
  ];

  if (sla.minRps !== undefined) {
    checks.push({
      metric: '吞吐率 (RPS)',
      actual: `${metrics.rps} req/s`,
      target: `>= ${sla.minRps} req/s`,
      passed: metrics.rps >= sla.minRps,
    });
  }

  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

export function evaluateBrowserSla(
  metrics: {
    errorRate: number;
    fcpP95Ms: number;
    loadP95Ms: number;
    totalJsErrors: number;
  },
  sla: {
    maxErrorRate: number;
    maxFcpP95Ms: number;
    maxLoadP95Ms: number;
    maxJsErrors: number;
  },
): SlaEvaluation {
  const checks: SlaEvaluation['checks'] = [
    {
      metric: '页面导航失败率',
      actual: `${round(metrics.errorRate * 100, 2)}%`,
      target: `<= ${round(sla.maxErrorRate * 100, 2)}%`,
      passed: metrics.errorRate <= sla.maxErrorRate,
    },
    {
      metric: 'FCP P95',
      actual: `${metrics.fcpP95Ms} ms`,
      target: `<= ${sla.maxFcpP95Ms} ms`,
      passed: metrics.fcpP95Ms <= sla.maxFcpP95Ms,
    },
    {
      metric: 'Load P95',
      actual: `${metrics.loadP95Ms} ms`,
      target: `<= ${sla.maxLoadP95Ms} ms`,
      passed: metrics.loadP95Ms <= sla.maxLoadP95Ms,
    },
    {
      metric: '运行时 JS 异常数',
      actual: `${metrics.totalJsErrors}`,
      target: `<= ${sla.maxJsErrors}`,
      passed: metrics.totalJsErrors <= sla.maxJsErrors,
    },
  ];
  return {
    passed: checks.every((c) => c.passed),
    checks,
  };
}

export function diagnoseBottlenecks(results: ScenarioResult[]): string[] {
  const notes: string[] = [];
  for (const res of results) {
    if (res.kind === 'http') {
      if (res.rateLimitedRequests > 0) {
        const ratio = round((res.rateLimitedRequests / Math.max(1, res.totalRequests)) * 100, 1);
        notes.push(
          `[${res.name}] 触发 ${res.rateLimitedRequests} 次 HTTP 429 限流（占 ${ratio}%）：单 IP 速率保护生效；若需压测后端纯写入上限，可调高后端 INGEST_RATE_LIMIT 或开启 --simulate-ips + TRUST_PROXY=true。`,
        );
      }
      if (res.errorRate > 0.02) {
        notes.push(
          `[${res.name}] 非限流错误率偏高（${round(res.errorRate * 100, 2)}%）：主要错误分布为 ${formatTopRecord(res.errorReasons)}，建议检查 Gunicorn Worker 数量、数据库连接池或目标服务存活状态。`,
        );
      }
      if (res.category === 'frontend-sdk' && res.latencyMs.p95 > 400) {
        notes.push(
          `[${res.name}] 监控上报 P95 达 ${res.latencyMs.p95}ms：建议在 L2/L3 流量下将后端切换为 INGEST_MODE=redis_queue 并启动 run_ingest_worker 异步落库，同时生产环境设置 SELF_LOG_ENABLED=false。`,
        );
      }
      if (res.category === 'backend-api' && res.latencyMs.p95 > 500) {
        notes.push(
          `[${res.name}] 后端查询 P95 达 ${res.latencyMs.p95}ms：建议检查 PostgreSQL 慢查询与索引命中（events / server_logs 范围聚合），必要时从 SQLite 切换至独立 PostgreSQL。`,
        );
      }
      if (res.category === 'frontend-assets' && res.ttfbMs.p95 > 200) {
        notes.push(
          `[${res.name}] 前端静态资源 TTFB P95 达 ${res.ttfbMs.p95}ms：开发态 Vite 按需编译开销较高，生产压测请使用 vite build + Nginx/CDN（参考 deploy/spa-nginx.conf）。`,
        );
      }
    } else if (res.driverUsed !== 'skipped') {
      if (res.totalJsErrors > 0) {
        notes.push(
          `[${res.name}] 浏览器高并发交互期间捕获到 ${res.totalJsErrors} 个未处理异常：${res.jsErrorSamples[0] ?? '详见报告异常列表'}。`,
        );
      }
      if (res.metrics.fcpMs.p95 > 2500) {
        notes.push(
          `[${res.name}] 浏览器首屏 FCP P95 达 ${res.metrics.fcpMs.p95}ms：建议检查首屏大图资源体积、路由懒加载分包与长任务阻塞。`,
        );
      }
      if (res.metrics.peakJsHeapMb > 180) {
        notes.push(
          `[${res.name}] 浏览器单实例 JS Heap 峰值达 ${res.metrics.peakJsHeapMb}MB：建议排查高频路由切换下的定时器、事件监听或状态缓存泄漏。`,
        );
      }
    }
  }
  if (notes.length === 0) {
    notes.push('所有已执行压测场景均满足当前档位 SLA 指标，未发现明显吞吐、延迟或内存瓶颈。');
  }
  return notes;
}

function formatTopRecord(record: Record<string, number>): string {
  const entries = Object.entries(record).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return '无';
  return entries
    .slice(0, 3)
    .map(([k, v]) => `${k}(${v})`)
    .join(', ');
}
