import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadStressConfig } from '../src/config/env';
import { getLoadProfile } from '../src/config/presets';
import { classifyCapacityStep, estimateUserCapacity } from '../src/core/capacity';
import { extractLocalAssetPaths } from '../src/core/context';
import {
  buildTimeline,
  diagnoseBottlenecks,
  evaluateBrowserSla,
  evaluateHttpSla,
  percentile,
  summarizeLatencies,
} from '../src/core/stats';

describe('stats & percentile calculations', () => {
  it('computes accurate percentiles and summary on latency samples', () => {
    const summary = summarizeLatencies([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    expect(summary.min).toBe(10);
    expect(summary.max).toBe(100);
    expect(summary.avg).toBe(55);
    expect(summary.p50).toBe(55);
    expect(summary.p90).toBe(91);
    expect(summary.p95).toBe(95.5);
    expect(percentile([], 95)).toBe(0);
  });

  it('aggregates HTTP samples into per-second timeline buckets', () => {
    const t0 = 1_700_000_000_000;
    const buckets = buildTimeline(
      [
        {
          timestampMs: t0 + 100,
          status: 200,
          ttfbMs: 5,
          durationMs: 12,
          bytes: 128,
          ok: true,
          rateLimited: false,
        },
        {
          timestampMs: t0 + 450,
          status: 429,
          ttfbMs: 4,
          durationMs: 8,
          bytes: 64,
          ok: true,
          rateLimited: true,
        },
        {
          timestampMs: t0 + 1200,
          status: 500,
          ttfbMs: 9,
          durationMs: 40,
          bytes: 80,
          ok: false,
          rateLimited: false,
        },
      ],
      t0,
      2,
    );
    expect(buckets).toHaveLength(2);
    expect(buckets[0]?.requests).toBe(2);
    expect(buckets[0]?.okCount).toBe(1);
    expect(buckets[0]?.rateLimitedCount).toBe(1);
    expect(buckets[1]?.errorCount).toBe(1);
  });

  it('evaluates HTTP and Browser SLA thresholds and diagnoses bottlenecks', () => {
    const httpSla = evaluateHttpSla(
      {
        errorRate: 0.05,
        latencyMs: summarizeLatencies([100, 200, 900]),
        rps: 45,
      },
      { maxErrorRate: 0.01, maxP95Ms: 500, maxP99Ms: 1000, minRps: 50 },
    );
    expect(httpSla.passed).toBe(false);

    const browserSla = evaluateBrowserSla(
      { errorRate: 0, fcpP95Ms: 650, loadP95Ms: 1200, totalJsErrors: 0 },
      { maxErrorRate: 0.02, maxFcpP95Ms: 2000, maxLoadP95Ms: 4000, maxJsErrors: 0 },
    );
    expect(browserSla.passed).toBe(true);

    const notes = diagnoseBottlenecks([]);
    expect(notes[0]).toContain('所有已执行压测场景均满足当前档位 SLA 指标');
  });
});

describe('config, presets & HTML asset extraction', () => {
  it('loads .env defaults and applies explicit environment overrides', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-cfg-'));
    try {
      fs.writeFileSync(
        path.join(tmpDir, '.env'),
        'STRESS_WEB_URL=http://127.0.0.1:8080/\nSTRESS_PROFILE=smoke\n',
        'utf8',
      );
      const cfg = loadStressConfig(tmpDir, { STRESS_SUITE: 'frontend' });
      expect(cfg.webUrl).toBe('http://127.0.0.1:8080');
      expect(cfg.profile).toBe('smoke');
      expect(cfg.suite).toBe('frontend');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('rejects invalid STRESS_PROFILE and supports concurrency/duration overrides', () => {
    expect(() => loadStressConfig(process.cwd(), { STRESS_PROFILE: 'invalid' })).toThrow(
      /Invalid STRESS_PROFILE/,
    );
    const custom = getLoadProfile('smoke', {
      concurrency: 12,
      durationSec: 5,
      browserConcurrency: 4,
    });
    expect(custom.httpPhases).toEqual([
      { name: 'custom-sustain', durationSec: 5, concurrency: 12 },
    ]);
    expect(custom.browserConcurrency).toBe(4);
  });

  it('extracts relative JS/CSS asset paths from SPA entry HTML', () => {
    const html = `
      <!doctype html>
      <html>
        <head>
          <link rel="icon" href="/favicon.svg" />
          <link rel="stylesheet" crossorigin href="/assets/index-Ab12Cd.css">
          <script type="module" crossorigin src="/assets/index-Xy98Zw.js"></script>
          <script src="https://cdn.example.com/external.js"></script>
        </head>
      </html>
    `;
    expect(extractLocalAssetPaths(html)).toEqual([
      '/favicon.svg',
      '/assets/index-Ab12Cd.css',
      '/assets/index-Xy98Zw.js',
    ]);
  });

  it('classifies step health zones and estimates CCU and DAU from step-up metrics', () => {
    expect(
      classifyCapacityStep({
        totalRequests: 100,
        okRequests: 100,
        rateLimitedRequests: 0,
        errorRate: 0,
        p95Ms: 220,
      }),
    ).toBe('healthy');
    expect(
      classifyCapacityStep({
        totalRequests: 100,
        okRequests: 100,
        rateLimitedRequests: 0,
        errorRate: 0.005,
        p95Ms: 900,
      }),
    ).toBe('degraded');
    expect(
      classifyCapacityStep({
        totalRequests: 100,
        okRequests: 100,
        rateLimitedRequests: 0,
        errorRate: 0.05,
        p95Ms: 400,
      }),
    ).toBe('overloaded');

    const est = estimateUserCapacity([
      {
        concurrency: 50,
        rps: 250,
        successRps: 250,
        totalRequests: 1000,
        okRequests: 1000,
        rateLimitedRequests: 0,
        failedRequests: 0,
        errorRate: 0,
        p50Ms: 40,
        p95Ms: 180,
        p99Ms: 260,
        cpuBusyPct: 42,
        loadAvg1m: 2.8,
        memUsedGb: 8.5,
        memTotalGb: 15,
        zone: 'healthy',
      },
      {
        concurrency: 200,
        rps: 380,
        successRps: 377.5,
        totalRequests: 1520,
        okRequests: 1510,
        rateLimitedRequests: 0,
        failedRequests: 10,
        errorRate: 0.006,
        p50Ms: 210,
        p95Ms: 980,
        p99Ms: 1300,
        cpuBusyPct: 86,
        loadAvg1m: 6.9,
        memUsedGb: 9.1,
        memTotalGb: 15,
        zone: 'degraded',
      },
    ]);
    expect(est.maxHealthyVus).toBe(50);
    expect(est.maxHealthyRps).toBe(250);
    expect(est.peakUsableRps).toBe(377.5);
    expect(est.recommendedOnlineUsers).toBe(1200);
    expect(est.recommendedDau).toBe(144000);
  });
});
