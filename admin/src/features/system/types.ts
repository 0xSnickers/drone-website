export type IngestMode = 'direct' | 'redis_queue';
export type EffectiveMode = 'direct' | 'redis_queue' | 'degraded_fallback';
export type BottleneckLevel = 'healthy' | 'approaching' | 'critical';
export type BottleneckFactor =
  | 'none'
  | 'cpu'
  | 'memory'
  | 'database_lock'
  | 'sqlite_concurrency'
  | 'latency'
  | 'queue_backlog'
  | 'server_errors'
  | 'throughput';

export interface HostResourceStatus {
  cpuCores: number;
  cpuPercent: number;
  loadAvg1m: number;
  loadRatio: number;
  memUsedGb: number;
  memTotalGb: number;
  memPercent: number;
}

export interface RealtimeTrafficStatus {
  currentRps: number;
  requests1m: number;
  p95LatencyMs: number;
  error5xx1m: number;
  rateLimited4291m: number;
  stressTrafficActive: boolean;
}

export interface BottleneckDiagnosis {
  level: BottleneckLevel;
  primaryFactor: BottleneckFactor;
  safeRpsBaseline: number;
  capacityPercent: number;
  headroomPercent: number;
}

export interface StressTestRuntimeStatus {
  active: boolean;
  runId: string | null;
  profile: string | null;
  suite: string | null;
  currentScenario: string | null;
  concurrency: number;
  startedAt: string | null;
  lastReport: {
    runId: string;
    generatedAt: string;
    profile: string;
    overallRps: number;
    errorRate: number;
    overallPassed: boolean;
  } | null;
}

export interface OnlineCapacityStatus {
  onlineUsers: number;
  activeSessions: number;
  estimatedMaxOnline: number;
  usagePercent: number;
  riskLevel: 'safe' | 'busy' | 'high';
  windowMinutes: number;
}

export interface SystemStatus {
  service: string;
  ingestMode: IngestMode;
  effectiveMode: EffectiveMode;
  database: {
    engine: 'postgresql' | 'sqlite';
    ok: boolean;
    latencyMs: number;
  };
  redis: {
    configured: boolean;
    ok: boolean;
    circuitOpen: boolean;
    circuitRemainingSec: number;
    eventsQueueDepth: number;
    logsQueueDepth: number;
  };
  protection: {
    ingestRateLimit: number;
    localTrackedIps: number;
    fallbackSampleRate: number;
    selfLogEnabled: boolean;
    trustProxy: boolean;
  };
  host?: HostResourceStatus;
  traffic?: RealtimeTrafficStatus;
  bottleneck?: BottleneckDiagnosis;
  stressTest?: StressTestRuntimeStatus;
  onlineCapacity?: OnlineCapacityStatus;
}
