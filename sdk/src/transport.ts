import type { MonitorEvent } from './types';

const MAX_QUEUE = 200;
const KEEPALIVE_LIMIT = 60_000;
const MAX_BACKOFF_MS = 60_000;

export interface TransportOptions {
  url: string;
  appKey: string;
  batchSize: number;
  flushInterval: number;
  /** 原生 fetch（在被 http 采集器代理之前保存），避免上报请求被自己采集。 */
  fetch?: typeof fetch;
  log: (...args: unknown[]) => void;
}

/** 计算指数退避 + 随机抖动（上限 60s），避免后端故障恢复瞬间产生惊群重试。 */
export function computeBackoffMs(
  failures: number,
  baseMs: number,
  rand: () => number = Math.random,
): number {
  if (failures <= 0) return 0;
  const exp = Math.min(MAX_BACKOFF_MS, Math.max(500, baseMs) * 2 ** (failures - 1));
  const jitter = Math.floor(rand() * 1000);
  return Math.min(MAX_BACKOFF_MS, exp + jitter);
}

/**
 * 批量发送队列：
 * - 攒够 batchSize 或每 flushInterval 发送一次；页面隐藏 / 关闭时用 sendBeacon 兜底。
 * - 用 text/plain 发送 JSON，跨域时不会触发 CORS 预检。
 * - 网络错误 / 5xx / 429 放回队列并按指数退避 + 抖动稍后重试；其他 4xx 直接丢弃。
 */
export class Transport {
  private queue: MonitorEvent[] = [];
  private timer: ReturnType<typeof setInterval> | undefined;
  private sending: Promise<void> | null = null;
  private stopped = false;
  private failures = 0;
  private nextRetryAt = 0;

  constructor(private readonly options: TransportOptions) {
    this.timer = setInterval(() => void this.autoFlush(), options.flushInterval);
  }

  push(event: MonitorEvent) {
    if (this.stopped) return;
    this.queue.push(event);
    if (this.queue.length > MAX_QUEUE) this.queue.splice(0, this.queue.length - MAX_QUEUE);
    if (this.queue.length >= this.options.batchSize) void this.autoFlush();
  }

  get size() {
    return this.queue.length;
  }

  private autoFlush(): Promise<void> | undefined {
    if (this.nextRetryAt > Date.now()) return undefined;
    return this.flush();
  }

  async flush(): Promise<void> {
    if (this.sending) return this.sending;
    if (!this.queue.length) return;
    const batch = this.queue.splice(0, 100);
    this.sending = this.send(batch).finally(() => {
      this.sending = null;
    });
    return this.sending;
  }

  /** 页面即将卸载：同步交给浏览器发送，不等待结果。 */
  flushOnUnload() {
    if (!this.queue.length) return;
    const body = this.body(this.queue.splice(0, 100));
    const beacon =
      typeof navigator !== 'undefined' ? navigator.sendBeacon?.bind(navigator) : undefined;
    if (beacon && beacon(this.options.url, new Blob([body], { type: 'text/plain' }))) return;
    void this.request(body, true).catch(() => undefined);
  }

  stop() {
    this.stopped = true;
    clearInterval(this.timer);
  }

  private body(events: MonitorEvent[]) {
    return JSON.stringify({ appKey: this.options.appKey, events });
  }

  private request(body: string, keepalive: boolean) {
    const doFetch = this.options.fetch ?? globalThis.fetch;
    return doFetch(this.options.url, {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
      credentials: 'omit',
      keepalive: keepalive && body.length < KEEPALIVE_LIMIT,
    });
  }

  private recordFailure() {
    this.failures += 1;
    this.nextRetryAt = Date.now() + computeBackoffMs(this.failures, this.options.flushInterval);
  }

  private async send(batch: MonitorEvent[]) {
    try {
      const res = await this.request(this.body(batch), true);
      if (res.ok) {
        this.failures = 0;
        this.nextRetryAt = 0;
        return;
      }
      if (res.status === 429 || res.status >= 500) {
        this.recordFailure();
        this.requeue(batch);
      } else {
        this.options.log('dropped batch, status', res.status);
      }
    } catch (error) {
      this.options.log('send failed, will retry', error);
      this.recordFailure();
      this.requeue(batch);
    }
  }

  private requeue(batch: MonitorEvent[]) {
    this.queue = [...batch, ...this.queue].slice(-MAX_QUEUE);
  }
}
