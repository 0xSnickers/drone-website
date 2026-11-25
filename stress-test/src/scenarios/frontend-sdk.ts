import type { LoadProfile } from '../config/types';
import type { RuntimeContext } from '../core/context';
import type { HttpScenarioDefinition } from '../core/load-runner';

const DRONE_URLS = [
  'https://aeroapex.local/',
  'https://aeroapex.local/flagship',
  'https://aeroapex.local/store?model=apex-x1',
  'https://aeroapex.local/academy',
  'https://aeroapex.local/community',
];

const TRACK_EVENTS = [
  'hero_cta_click',
  'drone_3d_rotate',
  'spec_comparison_toggle',
  'store_add_to_cart',
  'firmware_doc_download',
];

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0',
];

export function randomSimulatedIp(workerId: number, iteration: number): string {
  const b = ((workerId * 31 + iteration) % 250) + 1;
  const c = ((workerId * 17 + Math.floor(iteration / 250)) % 250) + 1;
  const d = ((iteration * 13 + workerId) % 250) + 2;
  return `10.128.${b}.${(c ^ d) % 250 || 1}`;
}

export function buildSdkEventBatch(
  appKey: string,
  batchSize: number,
  workerId: number,
  iteration: number,
  includeAppKeyInBody: boolean,
): string {
  const now = Date.now();
  const visitorId = `vis_stress_${workerId}_${iteration % 500}`;
  const sessionId = `ses_stress_${workerId}_${iteration % 100}`;
  const events: Array<Record<string, unknown>> = [];

  for (let i = 0; i < batchSize; i++) {
    const slot = (iteration + i) % 10;
    const url = DRONE_URLS[(workerId + i) % DRONE_URLS.length]!;

    if (slot < 5) {
      events.push({
        type: 'pageview',
        name: 'pageview',
        url,
        referrer: 'https://aeroapex.local/',
        visitorId,
        sessionId,
        release: 'stress-0.1.0',
        ts: now - i * 20,
        properties: { viewport: '1920x1080', lang: 'zh-CN' },
      });
    } else if (slot < 8) {
      events.push({
        type: 'track',
        name: TRACK_EVENTS[(workerId + i) % TRACK_EVENTS.length]!,
        url,
        visitorId,
        sessionId,
        release: 'stress-0.1.0',
        ts: now - i * 15,
        properties: { sku: 'APEX-PRO-X1', price: 12999 },
        breadcrumbs: [{ type: 'click', message: 'button "立即预订"', ts: now - 120 }],
      });
    } else if (slot === 8) {
      events.push({
        type: 'performance',
        name: 'page_load',
        url,
        visitorId,
        sessionId,
        ts: now,
        properties: {
          ttfbMs: 38 + (i % 30),
          fcpMs: 420 + (i % 180),
          loadMs: 780 + (i % 260),
          domInteractiveMs: 390,
        },
      });
    } else {
      events.push({
        type: 'error',
        name: 'error',
        url,
        visitorId,
        sessionId,
        release: 'stress-0.1.0',
        ts: now,
        breadcrumbs: [{ type: 'navigation', message: '/flagship -> /store', ts: now - 300 }],
        error: {
          type: i % 2 === 0 ? 'js' : 'promise',
          message: 'Telemetry gimbal preview frame timeout',
          stack: 'Error: Telemetry gimbal preview frame timeout\n    at renderGimbal (flagship.js:42:15)',
          source: 'flagship.js:42:15',
        },
      });
    }
  }

  return JSON.stringify(
    includeAppKeyInBody ? { appKey, events } : { events },
  );
}

export function buildFrontendSdkScenarios(
  ctx: RuntimeContext,
  profile: LoadProfile,
): HttpScenarioDefinition[] {
  if (!ctx.reachability.server.reachable) {
    return [];
  }

  return [
    {
      id: 'frontend-sdk-ingest',
      name: `前端监控 SDK 高频批量上报 (${profile.sdkBatchSize} events/req)`,
      category: 'frontend-sdk',
      targetUrl: `${ctx.config.serverUrl}/api/v1/ingest/events`,
      phases: profile.httpPhases,
      timeoutMs: profile.timeoutMs,
      sla: profile.sla.frontendSdk,
      nextRequest: (workerId, iteration) => {
        // 50% 模拟常规 fetch JSON + X-App-Key；50% 模拟 navigator.sendBeacon (text/plain + body appKey)
        const useBeaconMode = iteration % 2 === 1;
        const ua = USER_AGENTS[(workerId + iteration) % USER_AGENTS.length]!;
        const headers: Record<string, string> = {
          'content-type': useBeaconMode ? 'text/plain;charset=UTF-8' : 'application/json',
          'user-agent': ua,
          ...(useBeaconMode ? {} : { 'x-app-key': ctx.resolvedAppKey }),
          ...(ctx.config.simulateIps
            ? { 'x-forwarded-for': randomSimulatedIp(workerId, iteration) }
            : {}),
        };

        return {
          method: 'POST',
          url: `${ctx.config.serverUrl}/api/v1/ingest/events`,
          headers,
          body: buildSdkEventBatch(
            ctx.resolvedAppKey,
            profile.sdkBatchSize,
            workerId,
            iteration,
            useBeaconMode,
          ),
          allowRateLimit: true,
          validateBody: (_status, bodyText) => {
            try {
              const parsed = JSON.parse(bodyText) as {
                code?: number;
                data?: { accepted?: number };
              };
              if (parsed.code !== 0) return `API_CODE_${String(parsed.code)}`;
              if (typeof parsed.data?.accepted !== 'number') return 'MISSING_ACCEPTED_COUNT';
              return null;
            } catch {
              return 'INVALID_JSON_RESPONSE';
            }
          },
        };
      },
    },
  ];
}
