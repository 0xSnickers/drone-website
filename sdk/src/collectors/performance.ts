import type { CollectorContext, Teardown } from './context';

/** 首次加载的关键耗时（毫秒）：TTFB、FCP、DOMContentLoaded、Load。 */
export function readNavigationMetrics(): Record<string, number> | null {
  if (typeof performance === 'undefined' || typeof performance.getEntriesByType !== 'function')
    return null;
  const nav = performance.getEntriesByType('navigation')[0] as
    PerformanceNavigationTiming | undefined;
  if (!nav || !nav.loadEventEnd) return null;
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const metrics: Record<string, number> = {
    ttfb: Math.round(nav.responseStart),
    domReady: Math.round(nav.domContentLoadedEventEnd),
    load: Math.round(nav.loadEventEnd),
  };
  if (fcp) metrics.fcp = Math.round(fcp.startTime);
  return metrics;
}

export function collectPerformance(ctx: CollectorContext): Teardown {
  let timer: ReturnType<typeof setTimeout> | undefined;
  // loadEventEnd 在 load 回调之后才有值，延迟一拍读取。
  const report = () => {
    timer = setTimeout(() => {
      const metrics = readNavigationMetrics();
      if (metrics) ctx.performance(metrics);
    }, 0);
  };
  if (document.readyState === 'complete') report();
  else window.addEventListener('load', report, { once: true });
  return () => {
    clearTimeout(timer);
    window.removeEventListener('load', report);
  };
}
