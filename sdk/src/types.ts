/** 与 monitor-server 上报接口（POST /ingest/events）一一对应。 */
export type EventType = 'pageview' | 'track' | 'performance' | 'error';
export type ErrorType = 'js' | 'promise' | 'resource' | 'api' | 'custom';
export type Properties = Record<string, unknown>;

export interface Breadcrumb {
  type: 'pageview' | 'click' | 'http' | 'track' | 'custom';
  message: string;
  ts: number;
  data?: Properties;
}

export interface MonitorEvent {
  type: EventType;
  name: string;
  url: string;
  referrer?: string;
  visitorId: string;
  sessionId: string;
  userId?: string;
  release?: string;
  ts: number;
  properties?: Properties;
  breadcrumbs?: Breadcrumb[];
  error?: { type: ErrorType; message: string; stack?: string; source?: string };
}

export interface MonitorUser {
  id: string;
  [key: string]: unknown;
}

export interface MonitorOptions {
  /** 上报地址前缀，如 `https://monitor.example.com/api/v1`（同源代理时可写 `/api`）。 */
  endpoint: string;
  /** 后台「项目管理」里创建项目得到的 appKey。 */
  appKey: string;
  /** 版本号，便于定位哪个版本引入了异常。 */
  release?: string;
  /** 自动采集 PV：监听 history / hash 路由变化。已有路由埋点（如模板的 RouteTracker）时设为 false。默认 true。 */
  autoPageview?: boolean;
  /** 自动捕获 JS 错误、未处理的 Promise 拒绝、资源加载失败。默认 true。 */
  captureErrors?: boolean;
  /** 自动捕获 fetch / XHR 的失败请求（网络错误或状态码 ≥ httpErrorStatus）。默认 true。 */
  captureHttp?: boolean;
  /** 视为接口异常的最小状态码，默认 500。 */
  httpErrorStatus?: number;
  /** 首次加载时上报 TTFB / FCP / DOMReady / Load。默认 true。 */
  capturePerformance?: boolean;
  /** 点击带 `data-track="事件名"` 的元素时自动上报埋点。默认 true。 */
  autoTrackClicks?: boolean;
  /** 非异常数据的采样率（按访客），0~1，默认 1。 */
  sampleRate?: number;
  /** 攒够多少条发送一次，默认 10。 */
  batchSize?: number;
  /** 最长多久发送一次（毫秒），默认 5000。 */
  flushInterval?: number;
  /** 发送前修改或丢弃事件（返回 null 丢弃），可用于脱敏。 */
  beforeSend?: (event: MonitorEvent) => MonitorEvent | null;
  /** 在控制台打印 SDK 内部日志。 */
  debug?: boolean;
}

export interface Monitor {
  track(name: string, properties?: Properties): void;
  pageView(path?: string, properties?: Properties): void;
  captureError(error: unknown, properties?: Properties, options?: { type?: ErrorType }): void;
  identify(user: MonitorUser): void;
  reset(): void;
  addBreadcrumb(message: string, properties?: Properties): void;
  /** 立即发送队列中的数据。 */
  flush(): Promise<void>;
  /** 移除所有监听、还原被代理的 fetch / XHR / history。 */
  destroy(): void;
}
