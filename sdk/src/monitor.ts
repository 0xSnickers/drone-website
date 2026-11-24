import { collectClicks } from './collectors/clicks';
import type { CollectorContext, Teardown } from './collectors/context';
import { collectErrors } from './collectors/errors';
import { collectHttp } from './collectors/http';
import { collectPageviews } from './collectors/pageview';
import { collectPerformance } from './collectors/performance';
import { getSessionId, getVisitorId, inSample, userStore } from './identity';
import { Transport } from './transport';
import type {
  Breadcrumb,
  ErrorType,
  Monitor,
  MonitorEvent,
  MonitorOptions,
  Properties,
} from './types';

const MAX_BREADCRUMBS = 20;
/** 同一条错误 1 秒内只报一次；单页最多 100 条，防止死循环报错刷爆上报。 */
const ERROR_DEDUP_MS = 1000;
const MAX_ERRORS_PER_PAGE = 100;

const noop: Monitor = {
  track() {},
  pageView() {},
  captureError() {},
  identify() {},
  reset() {},
  addBreadcrumb() {},
  flush: async () => {},
  destroy() {},
};

/**
 * 创建监控实例。返回的对象实现了前端模板 `core/telemetry` 的 Telemetry 接口，
 * 可以直接 `telemetry.setImplementation(createMonitor({...}))`。
 * 非浏览器环境（SSR）返回空实现。
 */
export function createMonitor(options: MonitorOptions): Monitor {
  if (typeof window === 'undefined' || typeof document === 'undefined') return noop;

  const opts = {
    autoPageview: true,
    captureErrors: true,
    captureHttp: true,
    httpErrorStatus: 500,
    capturePerformance: true,
    autoTrackClicks: true,
    sampleRate: 1,
    batchSize: 10,
    flushInterval: 5000,
    ...options,
  };
  const log = (...args: unknown[]) => {
    if (opts.debug) console.info('[monitor]', ...args);
  };
  const endpoint = `${opts.endpoint.replace(/\/$/, '')}/ingest/events`;
  const transport = new Transport({
    url: endpoint,
    appKey: opts.appKey,
    batchSize: opts.batchSize,
    flushInterval: opts.flushInterval,
    fetch: typeof window.fetch === 'function' ? window.fetch.bind(window) : undefined,
    log,
  });

  const visitorId = getVisitorId();
  const sampled = inSample(visitorId, opts.sampleRate);
  let userId = userStore.get();
  let breadcrumbs: Breadcrumb[] = [];
  let lastUrl = document.referrer;
  let errorCount = 0;
  const recentErrors = new Map<string, number>();

  const addCrumb = (crumb: Omit<Breadcrumb, 'ts'>) => {
    breadcrumbs = [...breadcrumbs, { ...crumb, ts: Date.now() }].slice(-MAX_BREADCRUMBS);
  };

  const emit = (partial: Pick<MonitorEvent, 'type' | 'name'> & Partial<MonitorEvent>) => {
    if (partial.type !== 'error' && !sampled) return;
    const event: MonitorEvent = {
      url: window.location.href,
      visitorId,
      sessionId: getSessionId(),
      userId,
      release: opts.release,
      ts: Date.now(),
      ...partial,
    };
    let final: MonitorEvent | null = event;
    try {
      final = opts.beforeSend ? opts.beforeSend(event) : event;
    } catch (error) {
      log('beforeSend threw', error);
    }
    if (!final) return;
    log('queue', final.type, final.name);
    transport.push(final);
  };

  const reportError: CollectorContext['reportError'] = (type, message, detail = {}) => {
    const key = `${type}:${message}`;
    const now = Date.now();
    if (now - (recentErrors.get(key) ?? 0) < ERROR_DEDUP_MS || errorCount >= MAX_ERRORS_PER_PAGE)
      return;
    recentErrors.set(key, now);
    errorCount++;
    emit({
      type: 'error',
      name: message.slice(0, 100) || type,
      properties: detail.properties,
      breadcrumbs,
      error: { type, message: message.slice(0, 1000), stack: detail.stack, source: detail.source },
    });
  };

  const pageView = (path?: string, properties?: Properties) => {
    const url = path ? new URL(path, window.location.href).href : window.location.href;
    errorCount = 0;
    addCrumb({ type: 'pageview', message: url });
    emit({ type: 'pageview', name: 'pageview', url, referrer: lastUrl, properties });
    lastUrl = url;
  };

  const track = (name: string, properties?: Properties) => {
    addCrumb({ type: 'track', message: name });
    emit({ type: 'track', name, properties });
  };

  const ctx: CollectorContext = {
    endpoint,
    reportError,
    pageView,
    track,
    breadcrumb: addCrumb,
    performance: (metrics) => emit({ type: 'performance', name: 'page_load', properties: metrics }),
  };

  const teardowns: Teardown[] = [];
  const safely = (fn: () => Teardown) => {
    try {
      teardowns.push(fn());
    } catch (error) {
      log('collector failed', error);
    }
  };
  if (opts.captureErrors) safely(() => collectErrors(ctx));
  if (opts.captureHttp) safely(() => collectHttp(ctx, opts.httpErrorStatus));
  safely(() => collectClicks(ctx, opts.autoTrackClicks));
  if (opts.capturePerformance) safely(() => collectPerformance(ctx));
  if (opts.autoPageview) safely(() => collectPageviews(ctx));

  const onHide = () => {
    if (document.visibilityState === 'hidden') transport.flushOnUnload();
  };
  const onPageHide = () => transport.flushOnUnload();
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onPageHide);

  return {
    track,
    pageView,
    captureError(error, properties, { type = 'custom' }: { type?: ErrorType } = {}) {
      const err =
        error instanceof Error
          ? error
          : new Error(typeof error === 'string' ? error : JSON.stringify(error));
      const message =
        err.name && err.name !== 'Error' ? `${err.name}: ${err.message}` : err.message;
      reportError(type, message, { stack: err.stack, properties });
    },
    identify(user) {
      userId = String(user.id).slice(0, 64);
      userStore.set(userId);
    },
    reset() {
      userId = undefined;
      userStore.clear();
    },
    addBreadcrumb(message, properties) {
      addCrumb({ type: 'custom', message, data: properties });
    },
    flush: () => transport.flush(),
    destroy() {
      teardowns.forEach((fn) => fn());
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      transport.flushOnUnload();
      transport.stop();
    },
  };
}
