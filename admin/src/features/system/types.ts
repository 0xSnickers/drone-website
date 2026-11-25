export type IngestMode = 'direct' | 'redis_queue';
export type EffectiveMode = 'direct' | 'redis_queue' | 'degraded_fallback';

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
}
