import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BrowserDriver } from '../src/browser/types';
import { LOAD_PROFILES } from '../src/config/presets';
import type { StressRunReport } from '../src/config/types';
import { writeStressReports } from '../src/reporters';
import { runBrowserScenarioWithDriver } from '../src/scenarios/frontend-browser';

describe('browser stress scenario runner & multi-format report writers', () => {
  it('aggregates Web Vitals, heap memory, DOM nodes, and route metrics from BrowserDriver', async () => {
    const mockDriver: BrowserDriver = {
      name: 'playwright',
      async visitAndInteract({ route }) {
        return {
          route,
          ok: true,
          navigationMs: 210,
          ttfbMs: 18,
          fcpMs: route === '/' ? 320 : 280,
          lcpMs: 490,
          domContentLoadedMs: 260,
          loadEventMs: 520,
          jsHeapUsedMb: 34.5,
          domNodes: 420,
          interactionMs: 95,
          jsErrors: [],
        };
      },
      async close() {},
    };

    const result = await runBrowserScenarioWithDriver(
      {
        id: 'frontend-web-browser',
        name: 'Web 浏览器压测模拟',
        baseUrl: 'http://localhost:5173',
        routes: ['/', '/flagship', '/store'],
        interactionMode: 'web-showcase',
      },
      LOAD_PROFILES.smoke,
      mockDriver,
    );

    expect(result.driverUsed).toBe('playwright');
    expect(result.totalNavigations).toBe(6);
    expect(result.okNavigations).toBe(6);
    expect(result.metrics.fcpMs.p95).toBeGreaterThan(0);
    expect(result.metrics.peakJsHeapMb).toBe(34.5);
    expect(result.routeBreakdown).toHaveLength(3);
    expect(result.sla.passed).toBe(true);
  });

  it('writes HTML (with SVG charts), Markdown, and JSON reports to disk', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'stress-reports-'));
    try {
      const sampleReport: StressRunReport = {
        runId: 'stress-2026-11-25T01-30-00',
        generatedAt: '2026-11-25T01:30:00.000Z',
        durationSec: 3.2,
        profile: LOAD_PROFILES.smoke,
        suite: 'all',
        simulateIps: false,
        environment: {
          nodeVersion: process.version,
          platform: 'linux',
          arch: 'x64',
          cpuCount: 8,
        },
        reachability: {
          web: { url: 'http://localhost:5173', reachable: true, status: 200, latencyMs: 12 },
          admin: { url: 'http://localhost:5174', reachable: true, status: 200, latencyMs: 15 },
          server: {
            url: 'http://localhost:9000',
            reachable: true,
            ready: true,
            authenticated: true,
            resolvedAppKey: 'pk_demo_web',
            latencyMs: 9,
          },
        },
        results: [
          {
            kind: 'http',
            id: 'frontend-web-assets',
            name: '前台官网静态资源吞吐',
            category: 'frontend-assets',
            targetUrl: 'http://localhost:5173',
            startedAt: '2026-11-25T01:30:00.000Z',
            finishedAt: '2026-11-25T01:30:03.000Z',
            durationSec: 3,
            peakConcurrency: 8,
            totalRequests: 360,
            okRequests: 360,
            rateLimitedRequests: 0,
            failedRequests: 0,
            errorRate: 0,
            rps: 120,
            throughputBytesPerSec: 245760,
            totalBytes: 737280,
            latencyMs: { min: 4, avg: 18, p50: 16, p90: 28, p95: 34, p99: 49, max: 62 },
            ttfbMs: { min: 2, avg: 9, p50: 8, p90: 14, p95: 18, p99: 25, max: 30 },
            statusCounts: { '200': 360 },
            errorReasons: {},
            timeline: [
              {
                secondOffset: 1,
                timestampIso: '2026-11-25T01:30:00.000Z',
                requests: 120,
                okCount: 120,
                rateLimitedCount: 0,
                errorCount: 0,
                rps: 120,
                p95Ms: 32,
              },
            ],
            sla: {
              passed: true,
              checks: [{ metric: 'P95 延迟', actual: '34 ms', target: '<= 500 ms', passed: true }],
            },
          },
        ],
        summary: {
          totalScenarios: 1,
          passedScenarios: 1,
          failedScenarios: 0,
          skippedScenarios: 0,
          totalHttpRequests: 360,
          overallHttpRps: 120,
          overallHttpErrorRate: 0,
          totalBrowserNavigations: 0,
          overallPassed: true,
        },
        bottlenecks: ['所有已执行压测场景均满足当前档位 SLA 指标。'],
      };

      const saved = writeStressReports(sampleReport, tmpDir);
      expect(fs.existsSync(saved.htmlPath)).toBe(true);
      expect(fs.existsSync(saved.jsonPath)).toBe(true);
      expect(fs.existsSync(saved.markdownPath)).toBe(true);

      const html = fs.readFileSync(saved.htmlPath, 'utf8');
      expect(html).toContain('<svg');
      expect(html).toContain('OVERALL PASSED');

      const md = fs.readFileSync(saved.markdownPath, 'utf8');
      expect(md).toContain('前台官网静态资源吞吐');
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
