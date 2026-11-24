// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { createLogShipper } from '../src/node';

describe('createLogShipper', () => {
  it('batches logs with X-App-Key and records requests via middleware', async () => {
    const calls: { url: string; init: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        calls.push({ url, init });
        return new Response('{}', { status: 200 });
      }),
    );
    const shipper = createLogShipper({
      endpoint: 'http://m.test/api/v1',
      appKey: 'pk',
      service: 'api',
    });
    shipper.log({ level: 'error', message: 'boom' });

    let finish: () => void = () => {};
    const res = { statusCode: 502, on: (_: 'finish', cb: () => void) => (finish = cb) };
    const next = vi.fn();
    shipper.requestLogger()(
      { method: 'GET', originalUrl: '/x?y=1', ip: '1.2.3.4', headers: { 'x-request-id': 'r1' } },
      res,
      next,
    );
    finish();
    await shipper.close();

    expect(next).toHaveBeenCalled();
    expect(calls[0]!.url).toBe('http://m.test/api/v1/ingest/logs');
    expect(calls[0]!.init.headers).toMatchObject({ 'X-App-Key': 'pk' });
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.service).toBe('api');
    expect(body.logs[1]).toMatchObject({
      level: 'error',
      message: 'GET /x 502',
      status: 502,
      ip: '1.2.3.4',
      requestId: 'r1',
    });
    vi.unstubAllGlobals();
  });
});
