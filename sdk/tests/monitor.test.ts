import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createMonitor } from '../src';
import { getSessionId, inSample, SESSION_TIMEOUT_MS } from '../src/identity';
import { computeBackoffMs } from '../src/transport';
import type { Monitor } from '../src/types';
import { flushPromises, mockIngest } from './helpers';

const base = {
  endpoint: 'https://monitor.test/api/v1/',
  appKey: 'pk_test',
  capturePerformance: false,
  flushInterval: 60_000,
};

describe('createMonitor', () => {
  let monitor: Monitor;

  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });
  afterEach(() => monitor?.destroy());

  it('sends an initial pageview and SPA route changes, with stable visitor id and referrer chain', async () => {
    const { sent, bodies, fetchMock } = mockIngest();
    monitor = createMonitor(base);
    window.history.pushState(null, '', '/orders?id=1');
    window.history.pushState(null, '', '/orders?id=1'); // 同一地址不重复
    await monitor.flush();

    expect(fetchMock.mock.calls[0]![0]).toBe('https://monitor.test/api/v1/ingest/events');
    expect(fetchMock.mock.calls[0]![1]).toMatchObject({
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      credentials: 'omit',
    });
    expect(bodies[0]!.appKey).toBe('pk_test');
    expect(sent.map((e) => e.type)).toEqual(['pageview', 'pageview']);
    expect(sent[1]!.url).toBe('http://localhost:3000/orders?id=1');
    expect(sent[1]!.referrer).toBe(sent[0]!.url);
    expect(sent[0]!.visitorId).toBe(sent[1]!.visitorId);
    expect(sent[0]!.sessionId).toBe(sent[1]!.sessionId);
  });

  it('track / identify / reset / beforeSend', async () => {
    const { sent } = mockIngest();
    monitor = createMonitor({
      ...base,
      autoPageview: false,
      beforeSend: (e) =>
        e.name === 'secret' ? null : { ...e, properties: { ...e.properties, scrubbed: true } },
    });
    monitor.identify({ id: 'u1' });
    monitor.track('buy_click', { sku: 42 });
    monitor.track('secret');
    monitor.reset();
    monitor.track('after_logout');
    await monitor.flush();
    expect(sent.map((e) => [e.name, e.userId])).toEqual([
      ['buy_click', 'u1'],
      ['after_logout', undefined],
    ]);
    expect(sent[0]!.properties).toEqual({ sku: 42, scrubbed: true });
  });

  it('declarative click tracking via data-track attributes', async () => {
    const { sent } = mockIngest();
    monitor = createMonitor({ ...base, autoPageview: false });
    document.body.innerHTML =
      '<button data-track="signup_click" data-track-plan-name="pro"><span>Go</span></button>';
    document.querySelector('span')!.click();
    await monitor.flush();
    expect(sent[0]).toMatchObject({
      type: 'track',
      name: 'signup_click',
      properties: { planName: 'pro' },
    });
  });

  it('captures JS errors, promise rejections and resource errors with breadcrumbs, de-duplicated', async () => {
    const { sent } = mockIngest();
    monitor = createMonitor({ ...base, autoPageview: false });
    monitor.track('open_cart');
    const error = new TypeError("Cannot read properties of undefined (reading 'x')");
    const evt = new ErrorEvent('error', {
      message: error.message,
      error,
      filename: 'app.js',
      lineno: 3,
      colno: 9,
    });
    window.dispatchEvent(evt);
    window.dispatchEvent(evt); // 1 秒内重复的同一错误只报一次
    const rejection = new Event('unhandledrejection') as PromiseRejectionEvent;
    Object.defineProperty(rejection, 'reason', { value: { code: 42 } });
    window.dispatchEvent(rejection);
    const img = document.createElement('img');
    img.src = 'https://cdn.test/a.png';
    document.body.appendChild(img);
    img.dispatchEvent(new Event('error'));
    await monitor.flush();

    const errors = sent.filter((e) => e.type === 'error');
    expect(errors.map((e) => e.error!.type)).toEqual(['js', 'promise', 'resource']);
    expect(errors[0]!.error).toMatchObject({ message: error.message, source: 'app.js:3:9' });
    expect(errors[0]!.error!.stack).toContain('TypeError');
    expect(errors[0]!.breadcrumbs!.map((b) => b.message)).toContain('open_cart');
    expect(errors[1]!.error!.message).toBe('Unhandled rejection: {"code":42}');
    expect(errors[2]!.error!.message).toBe('Failed to load img: https://cdn.test/a.png');
  });

  it('captureError accepts an explicit type (used for API errors)', async () => {
    const { sent } = mockIngest();
    monitor = createMonitor({ ...base, autoPageview: false });
    monitor.captureError(new Error('boom'), { orderId: 1 }, { type: 'api' });
    monitor.captureError('plain string');
    await monitor.flush();
    expect(sent.map((e) => [e.error!.type, e.error!.message])).toEqual([
      ['api', 'boom'],
      ['custom', 'plain string'],
    ]);
    expect(sent[0]!.properties).toEqual({ orderId: 1 });
  });

  it('reports failed fetch calls but never its own upload requests', async () => {
    const { sent, fetchMock } = mockIngest();
    const upstream = vi.fn(async () => new Response('', { status: 503 }));
    const ingest = fetchMock;
    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) =>
      String(input).includes('/ingest/') ? ingest(input, init) : upstream()) as typeof fetch;
    monitor = createMonitor({ ...base, autoPageview: false });
    await window.fetch('/api/orders?page=2', { method: 'post' });
    await monitor.flush();
    expect(sent).toHaveLength(1);
    expect(sent[0]!.error).toMatchObject({ type: 'api', message: 'POST /api/orders 503' });
    expect(sent[0]!.breadcrumbs!.at(-1)!.message).toBe('POST /api/orders 503');
  });

  it('batches by size, retries after 5xx and drops on 4xx', async () => {
    let status = 503;
    const names: string[][] = [];
    window.fetch = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      names.push(
        (JSON.parse(String(init?.body)) as { events: { name: string }[] }).events.map(
          (e) => e.name,
        ),
      );
      return new Response('{}', { status });
    }) as unknown as typeof fetch;
    monitor = createMonitor({ ...base, autoPageview: false, captureHttp: false, batchSize: 2 });
    monitor.track('a');
    monitor.track('b'); // 达到 batchSize 自动发送 -> 503，放回队列
    await flushPromises();
    status = 200;
    monitor.track('c');
    await monitor.flush(); // 重试：失败的批次排在前面
    expect(names).toEqual([
      ['a', 'b'],
      ['a', 'b', 'c'],
    ]);

    status = 401;
    monitor.track('d');
    await monitor.flush();
    await monitor.flush(); // 4xx 已丢弃，不再重发
    expect(names).toHaveLength(3);
  });

  it('backs off with jitter after 5xx to prevent retry storms, then recovers', async () => {
    expect(computeBackoffMs(0, 5000, () => 0.5)).toBe(0);
    expect(computeBackoffMs(1, 5000, () => 0.5)).toBe(5500);
    expect(computeBackoffMs(3, 5000, () => 0.2)).toBe(20200);
    expect(computeBackoffMs(10, 5000, () => 0.9)).toBe(60000);

    vi.useFakeTimers();
    try {
      let status = 503;
      let calls = 0;
      window.fetch = vi.fn(async () => {
        calls += 1;
        return new Response('{}', { status });
      }) as unknown as typeof fetch;

      monitor = createMonitor({
        ...base,
        autoPageview: false,
        captureHttp: false,
        batchSize: 2,
        flushInterval: 1000,
      });
      monitor.track('e1');
      monitor.track('e2'); // triggers first autoFlush -> 503 -> enters backoff (>=1000ms)
      await vi.advanceTimersByTimeAsync(10);
      expect(calls).toBe(1);

      // Pushing more events during backoff window does not immediately hammer upstream
      monitor.track('e3');
      monitor.track('e4');
      await vi.advanceTimersByTimeAsync(200);
      expect(calls).toBe(1);

      // Upstream recovers; once backoff elapses, timer flushes queued batch
      status = 200;
      await vi.advanceTimersByTimeAsync(2000);
      expect(calls).toBe(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses sendBeacon when the page is hidden', () => {
    mockIngest();
    const beacon = vi.fn(() => true);
    Object.defineProperty(navigator, 'sendBeacon', { value: beacon, configurable: true });
    monitor = createMonitor({ ...base, autoPageview: false });
    monitor.track('leave');
    window.dispatchEvent(new Event('pagehide'));
    expect(beacon).toHaveBeenCalledWith(
      'https://monitor.test/api/v1/ingest/events',
      expect.any(Blob),
    );
  });

  it('sampling drops behaviour events but keeps errors', async () => {
    const { sent } = mockIngest();
    monitor = createMonitor({ ...base, sampleRate: 0 });
    monitor.track('x');
    monitor.captureError(new Error('kept'));
    await monitor.flush();
    expect(sent.map((e) => e.type)).toEqual(['error']);
  });

  it('restores patched globals on destroy', () => {
    mockIngest();
    const fetchBefore = window.fetch;
    const push = window.history.pushState;
    const m = createMonitor(base);
    expect(window.fetch).not.toBe(fetchBefore);
    m.destroy();
    expect(window.fetch).toBe(fetchBefore);
    expect(window.history.pushState).toBe(push);
  });
});

describe('identity', () => {
  it('rotates the session after 30 minutes of inactivity', () => {
    localStorage.clear();
    const a = getSessionId(1_000);
    expect(getSessionId(1_000 + SESSION_TIMEOUT_MS - 1)).toBe(a);
    expect(getSessionId(1_000 + 2 * SESSION_TIMEOUT_MS)).not.toBe(a);
  });

  it('samples deterministically per visitor', () => {
    expect(inSample('abc', 0.5)).toBe(inSample('abc', 0.5));
    const kept = Array.from({ length: 1000 }, (_, i) => inSample(`v${i}`, 0.3)).filter(
      Boolean,
    ).length;
    expect(kept).toBeGreaterThan(200);
    expect(kept).toBeLessThan(400);
  });
});
