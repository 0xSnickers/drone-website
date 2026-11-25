export type ProfileName = 'smoke' | 'l1-baseline' | 'l2-growth' | 'l3-burst' | 'spike';

export type SuiteName =
  'all' | 'frontend' | 'backend' | 'assets' | 'browser' | 'sdk' | 'api' | 'mixed';

export type ScenarioCategory =
  'frontend-assets' | 'frontend-browser' | 'frontend-sdk' | 'backend-api' | 'mixed';

export type BrowserDriverType = 'auto' | 'playwright' | 'cdp';

export interface LoadPhase {
  name: string;
  durationSec: number;
  concurrency: number;
}

export interface SlaThreshold {
  /** 最大非限流错误率（0 ~ 1），例如 0.01 代表 1% */
  maxErrorRate: number;
  /** P95 总耗时阈值（毫秒） */
  maxP95Ms: number;
  /** P99 总耗时阈值（毫秒） */
  maxP99Ms: number;
  /** 最低期望吞吐 RPS（可选） */
  minRps?: number;
  /** 最大拒绝率（默认 1%）；限流不属于服务崩溃，但不能视作可用容量。 */
  maxRateLimitRate?: number;
}

export interface LoadProfile {
  name: ProfileName;
  label: string;
  description: string;
  httpPhases: LoadPhase[];
  browserConcurrency: number;
  browserIterationsPerWorker: number;
  sdkBatchSize: number;
  timeoutMs: number;
  sla: {
    frontendAssets: SlaThreshold;
    frontendSdk: SlaThreshold;
    backendApi: SlaThreshold;
    browserRender: {
      maxErrorRate: number;
      maxFcpP95Ms: number;
      maxLoadP95Ms: number;
      maxJsErrors: number;
    };
  };
}

export interface StressEnvConfig {
  webUrl: string;
  adminUrl: string;
  serverUrl: string;
  adminEmail: string;
  adminPassword: string;
  appKey: string;
  profile: ProfileName;
  suite: SuiteName;
  simulateIps: boolean;
  allowPartial: boolean;
  browserDriver: BrowserDriverType;
  chromeBin: string;
  headless: boolean;
  reportDir: string;
}

export interface HttpRequestSpec {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
  /** 将 429 视为限流保护命中而非服务故障 */
  allowRateLimit?: boolean;
  /** 自定义业务响应断言（返回错误信息代表业务失败，返回 null 代表通过） */
  validateBody?: (status: number, bodyText: string) => string | null;
}

export interface HttpSample {
  timestampMs: number;
  status: number;
  ttfbMs: number;
  durationMs: number;
  bytes: number;
  ok: boolean;
  rateLimited: boolean;
  errorReason?: string;
}

export interface LatencySummary {
  min: number;
  avg: number;
  p50: number;
  p90: number;
  p95: number;
  p99: number;
  max: number;
}

export interface TimeSeriesBucket {
  secondOffset: number;
  timestampIso: string;
  requests: number;
  okCount: number;
  rateLimitedCount: number;
  errorCount: number;
  rps: number;
  p95Ms: number;
}

export interface SlaEvaluation {
  passed: boolean;
  checks: Array<{
    metric: string;
    actual: string;
    target: string;
    passed: boolean;
  }>;
}

export interface HttpScenarioResult {
  kind: 'http';
  id: string;
  name: string;
  category: ScenarioCategory;
  targetUrl: string;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  peakConcurrency: number;
  totalRequests: number;
  okRequests: number;
  rateLimitedRequests: number;
  failedRequests: number;
  errorRate: number;
  rps: number;
  successRps: number;
  rateLimitRate: number;
  successLatencyMs: LatencySummary;
  throughputBytesPerSec: number;
  totalBytes: number;
  latencyMs: LatencySummary;
  ttfbMs: LatencySummary;
  statusCounts: Record<string, number>;
  errorReasons: Record<string, number>;
  timeline: TimeSeriesBucket[];
  sla: SlaEvaluation;
}

export interface BrowserPageSample {
  route: string;
  ok: boolean;
  navigationMs: number;
  ttfbMs: number;
  fcpMs: number;
  lcpMs: number;
  domContentLoadedMs: number;
  loadEventMs: number;
  jsHeapUsedMb: number;
  domNodes: number;
  interactionMs: number;
  jsErrors: string[];
  errorReason?: string;
}

export interface BrowserScenarioResult {
  kind: 'browser';
  id: string;
  name: string;
  category: 'frontend-browser';
  driverUsed: 'playwright' | 'cdp' | 'skipped';
  targetUrl: string;
  startedAt: string;
  finishedAt: string;
  durationSec: number;
  concurrency: number;
  totalNavigations: number;
  okNavigations: number;
  failedNavigations: number;
  errorRate: number;
  totalJsErrors: number;
  jsErrorSamples: string[];
  skippedReason?: string;
  metrics: {
    navigationMs: LatencySummary;
    ttfbMs: LatencySummary;
    fcpMs: LatencySummary;
    lcpMs: LatencySummary;
    loadEventMs: LatencySummary;
    interactionMs: LatencySummary;
    peakJsHeapMb: number;
    avgDomNodes: number;
  };
  routeBreakdown: Array<{
    route: string;
    count: number;
    avgFcpMs: number;
    p95LoadMs: number;
    jsErrors: number;
  }>;
  sla: SlaEvaluation;
}

export type ScenarioResult = HttpScenarioResult | BrowserScenarioResult;

export interface TargetReachability {
  web: { url: string; reachable: boolean; status?: number; latencyMs?: number };
  admin: { url: string; reachable: boolean; status?: number; latencyMs?: number };
  server: {
    url: string;
    reachable: boolean;
    ready: boolean;
    authenticated: boolean;
    resolvedAppKey: string;
    latencyMs?: number;
  };
}

export interface StressRunReport {
  runId: string;
  generatedAt: string;
  durationSec: number;
  profile: LoadProfile;
  suite: SuiteName;
  simulateIps: boolean;
  environment: {
    nodeVersion: string;
    platform: string;
    arch: string;
    cpuCount: number;
  };
  reachability: TargetReachability;
  results: ScenarioResult[];
  summary: {
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    skippedScenarios: number;
    totalHttpRequests: number;
    overallHttpRps: number;
    overallHttpErrorRate: number;
    totalBrowserNavigations: number;
    overallPassed: boolean;
  };
  bottlenecks: string[];
}
