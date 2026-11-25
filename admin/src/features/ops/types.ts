export type ReleaseEnv = 'development' | 'staging' | 'production';
export type ReleaseStatus = 'success' | 'failed' | 'running' | 'rolled_back';

export interface ReleaseRecord {
  id: string;
  version: string;
  environment: ReleaseEnv;
  commitSha: string;
  branch: string;
  status: ReleaseStatus;
  triggeredBy: string;
  notes: string;
  ciSummary: Record<string, string>;
  deployedAt: string;
}

export interface CreateReleaseInput {
  version: string;
  environment: ReleaseEnv;
  commitSha?: string;
  branch?: string;
  status?: ReleaseStatus;
  triggeredBy?: string;
  notes?: string;
  ciSummary?: Record<string, string>;
}

export interface StressHttpScenario {
  id: string;
  name: string;
  category: string;
  peakConcurrency: number;
  totalRequests: number;
  successRequests: number;
  rateLimitedRequests: number;
  failedRequests: number;
  rps: number;
  successRps: number;
  errorRate: number;
  p50: number;
  p95: number;
  p99: number;
  passed: boolean;
}

export interface StressBrowserScenario {
  id: string;
  name: string;
  driver: string;
  concurrency: number;
  navigations: number;
  failedNavigations: number;
  fcpP95: number;
  lcpP95: number;
  loadP95: number;
  jsErrors: number;
  passed: boolean;
}

export interface StressRunSummary {
  id: string;
  runId: string;
  releaseVersion: string;
  profile: string;
  profileLabel: string;
  suite: string;
  passed: boolean;
  durationSec: number;
  totalRequests: number;
  overallRps: number;
  errorRate: number;
  passedScenarios: number;
  totalScenarios: number;
  startedAt: string;
}

export interface StressRunDetail extends StressRunSummary {
  httpScenarios: StressHttpScenario[];
  browserScenarios: StressBrowserScenario[];
  recommendations: string[];
  environment: Record<string, unknown>;
}

export interface PageResult<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
