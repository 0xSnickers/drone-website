import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadStressConfig } from '../src/config/env';
import type { LoadProfile } from '../src/config/types';
import { PreFlightError } from '../src/core/context';
import { executeStressSuite } from '../src/scenarios';

describe('full-stack stress suite integration against mock AeroApex services', () => {
  let webServer: http.Server;
  let adminServer: http.Server;
  let apiServer: http.Server;
  let webUrl = '';
  let adminUrl = '';
  let serverUrl = '';

  beforeAll(async () => {
    const spaHandler: http.RequestListener = (req, res) => {
      if (req.url?.startsWith('/assets/')) {
        res.writeHead(200, { 'content-type': 'application/javascript' });
        res.end('console.log("AeroApex bundle loaded");');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(
        '<!doctype html><html><head><script type="module" src="/assets/main.js"></script></head><body><div id="root"></div></body></html>',
      );
    };

    webServer = http.createServer(spaHandler);
    adminServer = http.createServer(spaHandler);
    apiServer = http.createServer((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (c: Buffer) => chunks.push(c));
      req.on('end', () => {
        const url = req.url ?? '/';
        const ok = (data: unknown, status = 200, extraHeaders?: Record<string, string>) => {
          res.writeHead(status, {
            'content-type': 'application/json',
            ...extraHeaders,
          });
          res.end(JSON.stringify({ code: 0, message: 'success', data }));
        };

        if (url === '/api/health') return ok({ status: 'ok' });
        if (url === '/api/ready') return ok({ status: 'ready' });
        if (url === '/api/v1/admin/auth/login') {
          return ok(
            {
              user: { id: 'u1', name: 'Demo', email: 'demo@example.com', role: 'admin' },
              accessToken: 'jwt-stress-test-token',
            },
            200,
            { 'set-cookie': 'admin_refresh_token=rt_mock_123; Path=/; HttpOnly' },
          );
        }
        if (url === '/api/v1/admin/auth/refresh') {
          return ok({
            user: { id: 'u1', name: 'Demo', email: 'demo@example.com', role: 'admin' },
            accessToken: 'jwt-stress-test-token',
          });
        }
        if (url === '/api/v1/admin/auth/me') {
          return ok({ id: 'u1', name: 'Demo', email: 'demo@example.com', role: 'admin' });
        }
        if (url.startsWith('/api/v1/projects')) {
          return ok({
            items: [{ id: 'p1', name: 'AeroApex Web', appKey: 'pk_test_aero' }],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
          });
        }
        if (url === '/api/v1/ingest/events' || url === '/api/v1/ingest/logs') {
          const bodyStr = Buffer.concat(chunks).toString('utf8');
          const parsed = JSON.parse(bodyStr) as {
            appKey?: string;
            events?: unknown[];
            logs?: unknown[];
          };
          const appKey = req.headers['x-app-key'] ?? parsed.appKey;
          if (appKey !== 'pk_test_aero') {
            res.writeHead(401, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ code: 'INVALID_APP_KEY', message: 'bad key', data: null }));
            return;
          }
          const accepted = parsed.events?.length ?? parsed.logs?.length ?? 0;
          return ok({ accepted });
        }
        return ok({ items: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0 } });
      });
    });

    await Promise.all([
      new Promise<void>((r) => webServer.listen(0, '127.0.0.1', r)),
      new Promise<void>((r) => adminServer.listen(0, '127.0.0.1', r)),
      new Promise<void>((r) => apiServer.listen(0, '127.0.0.1', r)),
    ]);

    webUrl = `http://127.0.0.1:${(webServer.address() as AddressInfo).port}`;
    adminUrl = `http://127.0.0.1:${(adminServer.address() as AddressInfo).port}`;
    serverUrl = `http://127.0.0.1:${(apiServer.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await Promise.all([
      new Promise<void>((r) => webServer.close(() => r())),
      new Promise<void>((r) => adminServer.close(() => r())),
      new Promise<void>((r) => apiServer.close(() => r())),
    ]);
  });

  it('discovers appKey, authenticates, and passes assets + sdk + backend + mixed stress suites', async () => {
    const fastProfile: LoadProfile = {
      name: 'smoke',
      label: 'Fast Test',
      description: 'Integration test profile',
      httpPhases: [{ name: 'burst', durationSec: 0.25, concurrency: 4 }],
      browserConcurrency: 1,
      browserIterationsPerWorker: 1,
      sdkBatchSize: 4,
      timeoutMs: 2000,
      sla: {
        frontendAssets: { maxErrorRate: 0, maxP95Ms: 1000, maxP99Ms: 2000 },
        frontendSdk: { maxErrorRate: 0, maxP95Ms: 1000, maxP99Ms: 2000 },
        backendApi: { maxErrorRate: 0, maxP95Ms: 1000, maxP99Ms: 2000 },
        browserRender: { maxErrorRate: 0, maxFcpP95Ms: 3000, maxLoadP95Ms: 5000, maxJsErrors: 0 },
      },
    };

    const config = loadStressConfig(process.cwd(), {
      STRESS_WEB_URL: webUrl,
      STRESS_ADMIN_URL: adminUrl,
      STRESS_SERVER_URL: serverUrl,
      STRESS_SUITE: 'all',
      STRESS_SIMULATE_IPS: 'true',
      STRESS_BROWSER_DRIVER: 'cdp',
      STRESS_CHROME_BIN: '/nonexistent/chrome-binary',
    });

    const report = await executeStressSuite(config, fastProfile);

    expect(report.reachability.web.reachable).toBe(true);
    expect(report.reachability.admin.reachable).toBe(true);
    expect(report.reachability.server.authenticated).toBe(true);
    expect(report.reachability.server.resolvedAppKey).toBe('pk_test_aero');
    expect(report.summary.totalHttpRequests).toBeGreaterThan(25);
    expect(report.summary.overallHttpErrorRate).toBe(0);
    expect(report.summary.failedScenarios).toBe(0);
    expect(report.summary.overallPassed).toBe(true);
  });

  it('blocks stress execution with PreFlightError when any required service is not running', async () => {
    const offlineConfig = loadStressConfig(process.cwd(), {
      STRESS_WEB_URL: 'http://127.0.0.1:65431',
      STRESS_ADMIN_URL: adminUrl,
      STRESS_SERVER_URL: serverUrl,
      STRESS_SUITE: 'all',
    });

    await expect(
      executeStressSuite(offlineConfig, {
        name: 'smoke',
        label: 'Smoke',
        description: 'test',
        httpPhases: [{ name: 'run', durationSec: 0.2, concurrency: 2 }],
        browserConcurrency: 1,
        browserIterationsPerWorker: 1,
        sdkBatchSize: 2,
        timeoutMs: 1000,
        sla: {
          frontendAssets: { maxErrorRate: 0, maxP95Ms: 500, maxP99Ms: 1000 },
          frontendSdk: { maxErrorRate: 0, maxP95Ms: 500, maxP99Ms: 1000 },
          backendApi: { maxErrorRate: 0, maxP95Ms: 500, maxP99Ms: 1000 },
          browserRender: { maxErrorRate: 0, maxFcpP95Ms: 3000, maxLoadP95Ms: 5000, maxJsErrors: 0 },
        },
      }),
    ).rejects.toBeInstanceOf(PreFlightError);
  });
});
