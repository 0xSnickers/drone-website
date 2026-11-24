import type { CollectorContext, Teardown } from './context';

const toPath = (url: string) => {
  try {
    const u = new URL(url, window.location.href);
    return u.origin === window.location.origin ? u.pathname : `${u.host}${u.pathname}`;
  } catch {
    return url.split('?')[0] ?? url;
  }
};

/** 代理 fetch / XHR：每个请求记一条操作路径；失败（网络错误或状态码 ≥ minStatus）上报为接口异常。 */
export function collectHttp(ctx: CollectorContext, minStatus: number): Teardown {
  const isOwn = (url: string) => url.startsWith(ctx.endpoint) || url.includes('/ingest/events');
  const report = (method: string, url: string, status: number, duration: number) => {
    const path = toPath(url);
    ctx.breadcrumb({
      type: 'http',
      message: `${method} ${path} ${status || 'ERR'}`,
      data: { duration },
    });
    if (status === 0 || status >= minStatus) {
      ctx.reportError('api', `${method} ${path} ${status || 'Network Error'}`, {
        properties: { method, url: url.split('?')[0], status, duration },
      });
    }
  };

  const originalFetch = window.fetch;
  if (typeof originalFetch === 'function') {
    window.fetch = async function patchedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      const method = (
        init?.method ?? (input instanceof Request ? input.method : 'GET')
      ).toUpperCase();
      if (isOwn(url)) return originalFetch.call(window, input, init);
      const start = Date.now();
      try {
        const res = await originalFetch.call(window, input, init);
        report(method, url, res.status, Date.now() - start);
        return res;
      } catch (error) {
        report(method, url, 0, Date.now() - start);
        throw error;
      }
    };
  }

  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;
  type Tracked = XMLHttpRequest & { __monitor?: { method: string; url: string } };
  proto.open = function (this: Tracked, method: string, url: string | URL, ...rest: unknown[]) {
    this.__monitor = { method: method.toUpperCase(), url: String(url) };
    return (originalOpen as (...args: unknown[]) => void).call(this, method, url, ...rest);
  } as typeof proto.open;
  proto.send = function (this: Tracked, body?: Document | XMLHttpRequestBodyInit | null) {
    const info = this.__monitor;
    if (info && !isOwn(info.url)) {
      const start = Date.now();
      this.addEventListener('loadend', () =>
        report(info.method, info.url, this.status, Date.now() - start),
      );
    }
    return originalSend.call(this, body);
  };

  return () => {
    window.fetch = originalFetch;
    proto.open = originalOpen;
    proto.send = originalSend;
  };
}
