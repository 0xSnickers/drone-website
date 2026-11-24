/**
 * Node.js 后端日志上报：把请求日志 / 应用日志批量发送到 monitor-server（POST /ingest/logs）。
 *
 *   import { createLogShipper } from 'monitor-sdk/node';
 *   const shipper = createLogShipper({ endpoint: 'http://monitor:9000/api/v1', appKey: 'pk_xxx', service: 'order-api' });
 *   app.use(shipper.requestLogger());           // Express / Nest（platform-express）
 *   shipper.log({ level: 'error', message: 'payment timeout', meta: { orderId } });
 *
 * 依赖 Node 18+ 的全局 fetch，零依赖。
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  level: LogLevel;
  message: string;
  ts?: number;
  requestId?: string;
  method?: string;
  path?: string;
  status?: number;
  durationMs?: number;
  /** 终端用户 IP。 */
  ip?: string;
  userAgent?: string;
  meta?: Record<string, unknown>;
}

export interface LogShipperOptions {
  endpoint: string;
  appKey: string;
  service: string;
  batchSize?: number;
  flushInterval?: number;
  /** 发送失败时的回调（默认静默丢弃，日志上报不能影响业务）。 */
  onError?: (error: unknown) => void;
}

type Req = {
  method?: string;
  originalUrl?: string;
  url?: string;
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
};
type Res = { statusCode: number; on(event: 'finish', cb: () => void): unknown };

const MAX_QUEUE = 2000;

export function createLogShipper(options: LogShipperOptions) {
  const { batchSize = 50, flushInterval = 3000 } = options;
  const url = `${options.endpoint.replace(/\/$/, '')}/ingest/logs`;
  let queue: LogEntry[] = [];
  let sending: Promise<void> | null = null;

  const flush = async (): Promise<void> => {
    if (sending) return sending;
    if (!queue.length) return;
    const logs = queue.splice(0, 200);
    sending = fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-App-Key': options.appKey },
      body: JSON.stringify({ service: options.service, logs }),
    })
      .then((res) => {
        if (res.status === 429 || res.status >= 500) queue = [...logs, ...queue].slice(-MAX_QUEUE);
        else if (!res.ok) options.onError?.(new Error(`log ingest rejected: ${res.status}`));
      })
      .catch((error: unknown) => {
        queue = [...logs, ...queue].slice(-MAX_QUEUE);
        options.onError?.(error);
      })
      .finally(() => {
        sending = null;
      });
    return sending;
  };

  const timer = setInterval(() => void flush(), flushInterval);
  (timer as { unref?: () => void }).unref?.();

  const log = (entry: LogEntry) => {
    queue.push({ ts: Date.now(), ...entry, message: entry.message.slice(0, 2000) });
    if (queue.length > MAX_QUEUE) queue.splice(0, queue.length - MAX_QUEUE);
    if (queue.length >= batchSize) void flush();
  };

  /** Express 风格中间件：每个请求结束后记录方法、路径、状态码、耗时、IP、UA、X-Request-ID。 */
  const requestLogger =
    () =>
    (req: Req, res: Res, next: () => void): void => {
      const start = Date.now();
      res.on('finish', () => {
        const header = (name: string) => {
          const value = req.headers[name];
          return Array.isArray(value) ? value[0] : value;
        };
        const status = res.statusCode;
        const path = req.originalUrl ?? req.url ?? '';
        log({
          level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
          message: `${req.method} ${path.split('?')[0]} ${status}`,
          method: req.method,
          path: path.slice(0, 512),
          status,
          durationMs: Date.now() - start,
          ip: req.ip ?? req.socket?.remoteAddress,
          userAgent: header('user-agent'),
          requestId: header('x-request-id'),
        });
      });
      next();
    };

  return {
    log,
    requestLogger,
    flush,
    /** 进程退出前调用，发送剩余日志。 */
    async close() {
      clearInterval(timer);
      // 失败会放回队列，最多尝试几轮，避免服务不可用时卡住退出流程。
      for (let i = 0; i < 5 && queue.length; i++) await flush();
    },
  };
}
