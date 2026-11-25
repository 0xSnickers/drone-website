import type { BrowserDriverType, BrowserPageSample } from '../config/types';

export interface BrowserVisitOptions {
  baseUrl: string;
  route: string;
  timeoutMs: number;
  interactionMode: 'web-showcase' | 'admin-console';
  credentials?: {
    email: string;
    password: string;
  };
}

export interface BrowserDriver {
  readonly name: 'playwright' | 'cdp';
  visitAndInteract(options: BrowserVisitOptions): Promise<BrowserPageSample>;
  close(): Promise<void>;
}

export interface BrowserDriverOptions {
  driverPreference: BrowserDriverType;
  chromeBin?: string;
  headless: boolean;
}

/**
 * 注入到新文档首帧的性能观察脚本，用于采集 Largest Contentful Paint (LCP)。
 */
export const LCP_INIT_SCRIPT = `
(() => {
  window.__stressLcpMs = 0;
  try {
    const po = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last && typeof last.startTime === 'number') {
        window.__stressLcpMs = Math.max(window.__stressLcpMs, last.startTime);
      }
    });
    po.observe({ type: 'largest-contentful-paint', buffered: true });
  } catch {}
})();
`;

/**
 * 在浏览器上下文内模拟高频滚动与安全交互（不触发外部跳转），返回交互耗时。
 */
export function buildInteractionScript(
  mode: 'web-showcase' | 'admin-console',
  credentials?: { email: string; password: string },
): string {
  const credsJson = JSON.stringify(credentials ?? null);
  return `
(async () => {
  const t0 = performance.now();
  const pause = (ms) => new Promise((r) => setTimeout(r, ms));

  // 1. 模拟视口分段高频滚动，触发懒加载与动画帧
  const docHeight = Math.max(document.body?.scrollHeight || 0, 1200);
  for (const ratio of [0.35, 0.7, 1.0, 0]) {
    window.scrollTo({ top: Math.floor(docHeight * ratio), behavior: 'instant' });
    await pause(25);
  }

  // 2. 管理端登录页交互压测：填充表单触发受控组件重渲染与校验
  const creds = ${credsJson};
  if (${JSON.stringify(mode)} === 'admin-console' && creds) {
    const emailInput = document.querySelector('input[type="email"]');
    const pwdInput = document.querySelector('input[type="password"]');
    const setNativeValue = (el, val) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      if (setter) setter.call(el, val);
      else el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    };
    if (emailInput && pwdInput) {
      setNativeValue(emailInput, creds.email);
      setNativeValue(pwdInput, creds.password);
      await pause(30);
    }
  } else {
    // 前台展示站：触发按钮/Tab 悬停事件与焦点切换
    const buttons = Array.from(document.querySelectorAll('button')).slice(0, 4);
    for (const btn of buttons) {
      btn.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
      await pause(15);
    }
  }

  return Math.round((performance.now() - t0) * 100) / 100;
})()
`;
}

/**
 * 在页面内读取 Navigation Timing、Paint Timing、LCP、DOM 节点数与内存占用。
 */
export const COLLECT_VITALS_SCRIPT = `
(() => {
  const nav = performance.getEntriesByType('navigation')[0];
  const paints = performance.getEntriesByType('paint');
  const fcpEntry = paints.find((p) => p.name === 'first-contentful-paint');
  const ttfbMs = nav ? Math.max(0, nav.responseStart - nav.requestStart) : 0;
  const domContentLoadedMs = nav ? Math.max(0, nav.domContentLoadedEventEnd) : 0;
  const loadEventMs = nav && nav.loadEventEnd > 0 ? nav.loadEventEnd : performance.now();
  const fcpMs = fcpEntry ? fcpEntry.startTime : domContentLoadedMs;
  const lcpMs = window.__stressLcpMs > 0 ? window.__stressLcpMs : fcpMs;
  const mem = performance.memory ? performance.memory.usedJSHeapSize / (1024 * 1024) : 0;
  const domNodes = document.getElementsByTagName('*').length;
  return {
    ttfbMs: Math.round(ttfbMs * 100) / 100,
    fcpMs: Math.round(fcpMs * 100) / 100,
    lcpMs: Math.round(lcpMs * 100) / 100,
    domContentLoadedMs: Math.round(domContentLoadedMs * 100) / 100,
    loadEventMs: Math.round(loadEventMs * 100) / 100,
    jsHeapUsedMb: Math.round(mem * 100) / 100,
    domNodes,
  };
})()
`;
