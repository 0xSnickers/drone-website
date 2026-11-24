import { vi } from 'vitest';
import type { MonitorEvent } from '../src/types';

/** 拦截 SDK 的上报请求，收集发送出去的事件。 */
export function mockIngest(status = 200) {
  const sent: MonitorEvent[] = [];
  const bodies: { appKey: string; events: MonitorEvent[] }[] = [];
  const fetchMock = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as { appKey: string; events: MonitorEvent[] };
    bodies.push(body);
    sent.push(...body.events);
    return new Response('{}', { status });
  });
  window.fetch = fetchMock as unknown as typeof fetch;
  return { sent, bodies, fetchMock };
}

export const flushPromises = () => new Promise((r) => setTimeout(r, 0));
