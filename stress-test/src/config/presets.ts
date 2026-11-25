import type { LoadProfile, ProfileName } from './types';

/**
 * 压测预设档位：与 docs/CICD_AND_DISASTER_RECOVERY.md 四阶段容量规划严格对齐：
 * - smoke: 快速冒烟验证（CI 门禁 / 本地联调，单场景约 3 秒）
 * - l1-baseline: L1 起步期基线（DAU < 5k，峰值并发 ~20-40，QPS > 30）
 * - l2-growth: L2 增长期水位（DAU 5k~50k，峰值并发 ~120，QPS ~300）
 * - l3-burst: L3 爆发期高压（DAU 50k~500k，峰值并发 ~300，需开启 Redis 队列削峰）
 * - spike: 瞬时脉冲洪峰测试（模拟热点突发流量骤升骤降，验证限流与自动恢复）
 */
export const LOAD_PROFILES: Record<ProfileName, LoadProfile> = {
  smoke: {
    name: 'smoke',
    label: 'Smoke 快速冒烟',
    description: '低并发短时全链路连通性与契约基准校验（适合本地快速自检与 CI）',
    httpPhases: [
      { name: 'warm-up', durationSec: 1, concurrency: 4 },
      { name: 'sustain', durationSec: 2, concurrency: 8 },
    ],
    browserConcurrency: 2,
    browserIterationsPerWorker: 1,
    sdkBatchSize: 5,
    timeoutMs: 5000,
    sla: {
      frontendAssets: { maxErrorRate: 0.01, maxP95Ms: 500, maxP99Ms: 1000 },
      frontendSdk: { maxErrorRate: 0.02, maxP95Ms: 800, maxP99Ms: 1500 },
      backendApi: { maxErrorRate: 0.02, maxP95Ms: 800, maxP99Ms: 1500 },
      browserRender: { maxErrorRate: 0.05, maxFcpP95Ms: 3000, maxLoadP95Ms: 5000, maxJsErrors: 0 },
    },
  },
  'l1-baseline': {
    name: 'l1-baseline',
    label: 'L1 起步期基线',
    description: '对应 DAU < 5,000 单机基线容量（阶梯加压至 30 并发，验证常规响应 SLA）',
    httpPhases: [
      { name: 'warm-up', durationSec: 2, concurrency: 8 },
      { name: 'ramp-up', durationSec: 4, concurrency: 20 },
      { name: 'sustain', durationSec: 6, concurrency: 30 },
    ],
    browserConcurrency: 3,
    browserIterationsPerWorker: 2,
    sdkBatchSize: 10,
    timeoutMs: 6000,
    sla: {
      frontendAssets: { maxErrorRate: 0.01, maxP95Ms: 300, maxP99Ms: 600, minRps: 30 },
      frontendSdk: { maxErrorRate: 0.01, maxP95Ms: 500, maxP99Ms: 1000, minRps: 25 },
      backendApi: { maxErrorRate: 0.01, maxP95Ms: 600, maxP99Ms: 1200, minRps: 20 },
      browserRender: { maxErrorRate: 0.02, maxFcpP95Ms: 2500, maxLoadP95Ms: 4500, maxJsErrors: 0 },
    },
  },
  'l2-growth': {
    name: 'l2-growth',
    label: 'L2 增长期高压',
    description: '对应 DAU 5k~50k 增长期容量（阶梯加压至 100 并发，目标峰值 QPS ~300）',
    httpPhases: [
      { name: 'warm-up', durationSec: 3, concurrency: 20 },
      { name: 'ramp-up', durationSec: 6, concurrency: 60 },
      { name: 'sustain', durationSec: 10, concurrency: 100 },
    ],
    browserConcurrency: 5,
    browserIterationsPerWorker: 3,
    sdkBatchSize: 20,
    timeoutMs: 8000,
    sla: {
      frontendAssets: { maxErrorRate: 0.01, maxP95Ms: 400, maxP99Ms: 800, minRps: 100 },
      frontendSdk: { maxErrorRate: 0.02, maxP95Ms: 800, maxP99Ms: 1500, minRps: 80 },
      backendApi: { maxErrorRate: 0.02, maxP95Ms: 1000, maxP99Ms: 2000, minRps: 60 },
      browserRender: { maxErrorRate: 0.05, maxFcpP95Ms: 3000, maxLoadP95Ms: 5500, maxJsErrors: 0 },
    },
  },
  'l3-burst': {
    name: 'l3-burst',
    label: 'L3 爆发期极限',
    description: '对应 DAU 50k~500k 集群与异步削峰阶段（阶梯加压至 250 并发，检验队列与连接池极限）',
    httpPhases: [
      { name: 'warm-up', durationSec: 4, concurrency: 40 },
      { name: 'ramp-up', durationSec: 8, concurrency: 140 },
      { name: 'sustain', durationSec: 12, concurrency: 250 },
    ],
    browserConcurrency: 8,
    browserIterationsPerWorker: 3,
    sdkBatchSize: 50,
    timeoutMs: 10000,
    sla: {
      frontendAssets: { maxErrorRate: 0.02, maxP95Ms: 600, maxP99Ms: 1200, minRps: 250 },
      frontendSdk: { maxErrorRate: 0.03, maxP95Ms: 1200, maxP99Ms: 2500, minRps: 150 },
      backendApi: { maxErrorRate: 0.03, maxP95Ms: 1500, maxP99Ms: 3000, minRps: 100 },
      browserRender: { maxErrorRate: 0.05, maxFcpP95Ms: 3500, maxLoadP95Ms: 6500, maxJsErrors: 0 },
    },
  },
  spike: {
    name: 'spike',
    label: 'Spike 瞬时脉冲洪峰',
    description: '模拟新品无人机发布会突发流量（低水位 -> 180 并发尖峰 -> 回落恢复验证）',
    httpPhases: [
      { name: 'baseline', durationSec: 3, concurrency: 10 },
      { name: 'spike-peak', durationSec: 5, concurrency: 180 },
      { name: 'recovery', durationSec: 4, concurrency: 15 },
    ],
    browserConcurrency: 6,
    browserIterationsPerWorker: 2,
    sdkBatchSize: 30,
    timeoutMs: 8000,
    sla: {
      frontendAssets: { maxErrorRate: 0.02, maxP95Ms: 700, maxP99Ms: 1500 },
      frontendSdk: { maxErrorRate: 0.03, maxP95Ms: 1200, maxP99Ms: 2500 },
      backendApi: { maxErrorRate: 0.03, maxP95Ms: 1500, maxP99Ms: 3000 },
      browserRender: { maxErrorRate: 0.05, maxFcpP95Ms: 3500, maxLoadP95Ms: 6000, maxJsErrors: 0 },
    },
  },
};

export function getLoadProfile(
  name: ProfileName,
  overrides?: { concurrency?: number; durationSec?: number; browserConcurrency?: number },
): LoadProfile {
  const base = LOAD_PROFILES[name];
  if (!overrides?.concurrency && !overrides?.durationSec && !overrides?.browserConcurrency) {
    return base;
  }
  return {
    ...base,
    httpPhases:
      overrides.concurrency || overrides.durationSec
        ? [
            {
              name: 'custom-sustain',
              durationSec:
                overrides.durationSec ?? base.httpPhases.reduce((s, p) => s + p.durationSec, 0),
              concurrency:
                overrides.concurrency ?? Math.max(...base.httpPhases.map((p) => p.concurrency)),
            },
          ]
        : base.httpPhases,
    browserConcurrency: overrides.browserConcurrency
      ? Math.max(1, Math.min(16, overrides.browserConcurrency))
      : base.browserConcurrency,
  };
}
