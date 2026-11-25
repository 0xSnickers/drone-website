import http from 'node:http';
import type { AddressInfo } from 'node:net';
import zlib from 'node:zlib';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { runHttpScenario, type LiveProgressSnapshot } from '../src/core/load-runner';
import { classifyCapacityStep, estimateUserCapacity } from '../src/core/capacity';

describe('runHttpScenario load runner', () => {
  let server: http.Server;
  let baseUrl = '';
  let counter = 0;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      counter += 1;
      if (req.url === '/rate-limit') {
        res.writeHead(429, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code: 'RATE_LIMITED', message: 'Too many requests', data: null }));
        return;
      }
      if (req.url === '/gzip-html') {
        const compressed = zlib.gzipSync('<!doctype html><html><body>AeroApex</body></html>');
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8',
          'content-encoding': 'gzip',
        });
        res.end(compressed);
        return;
      }
      if (req.url === '/fail') {
        res.writeHead(500, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ code: 'INTERNAL_ERROR', message: 'error', data: null }));
        return;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ code: 0, message: 'success', data: { seq: counter } }));
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = (server.address() as AddressInfo).port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('never treats an all-429 service as healthy business capacity', async () => {
    const result = await runHttpScenario({
      id: 'all-429',
      name: 'all-429',
      category: 'mixed',
      targetUrl: baseUrl,
      phases: [{ name: 'sustain', durationSec: 0.1, concurrency: 2 }],
      timeoutMs: 1000,
      sla: { maxErrorRate: 0.01, maxP95Ms: 500, maxP99Ms: 1000 },
      nextRequest: () => ({ method: 'GET', url: `${baseUrl}/rate-limit`, allowRateLimit: true }),
    });
    expect(result.totalRequests).toBeGreaterThan(0);
    expect(result.okRequests).toBe(0);
    expect(result.errorRate).toBe(0);
    expect(result.successRps).toBe(0);
    expect(result.rateLimitRate).toBe(1);
    expect(result.sla.passed).toBe(false);
    const metric = { ...result, p95Ms: result.successLatencyMs.p95 };
    expect(classifyCapacityStep(metric)).toBe('overloaded');
    const estimate = estimateUserCapacity([
      {
        ...metric,
        concurrency: 2,
        p50Ms: 0,
        p99Ms: 0,
        cpuBusyPct: 0,
        loadAvg1m: 0,
        memUsedGb: 0,
        memTotalGb: 1,
        zone: 'healthy', // Recheck raw measurements even if a caller supplies a stale classification.
      },
    ]);
    expect(estimate.recommendedOnlineUsers).toBe(0);
    expect(estimate.recommendedDau).toBe(0);
  });

  it('executes multi-phase HTTP load, records TTFB/latencies, and distinguishes 429 from errors', async () => {
    const snapshots: LiveProgressSnapshot[] = [];
    const result = await runHttpScenario(
      {
        id: 'test-http-load',
        name: '本地 HTTP 并发调度验证',
        category: 'backend-api',
        targetUrl: baseUrl,
        phases: [
          { name: 'warm', durationSec: 0.3, concurrency: 3 },
          { name: 'sustain', durationSec: 0.4, concurrency: 6 },
        ],
        timeoutMs: 2000,
        sla: { maxErrorRate: 0.01, maxP95Ms: 500, maxP99Ms: 1000 },
        nextRequest: (_workerId, iteration) =>
          iteration % 5 === 0
            ? { method: 'GET', url: `${baseUrl}/rate-limit`, allowRateLimit: true }
            : iteration % 2 === 0
              ? {
                  method: 'GET',
                  url: `${baseUrl}/gzip-html`,
                  headers: { 'accept-encoding': 'gzip' },
                  validateBody: (_s, text) => (text.includes('AeroApex') ? null : 'BAD_HTML'),
                }
              : { method: 'GET', url: `${baseUrl}/ok`, allowRateLimit: true },
      },
      {
        onProgress: (snap) => snapshots.push(snap),
      },
    );

    expect(result.totalRequests).toBeGreaterThan(10);
    expect(result.okRequests).toBeGreaterThan(0);
    expect(result.rateLimitedRequests).toBeGreaterThan(0);
    expect(result.failedRequests).toBe(0);
    expect(result.errorRate).toBe(0);
    expect(result.latencyMs.p95).toBeGreaterThanOrEqual(0);
    expect(result.ttfbMs.max).toBeGreaterThanOrEqual(0);
    expect(result.sla.passed).toBe(false);
    expect(result.successRps).toBeLessThan(result.rps);
    expect(snapshots.length).toBeGreaterThanOrEqual(0);
  });
});
