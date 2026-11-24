import type { Breadcrumb, ErrorType, Properties } from '../types';

/** 采集器只依赖这组能力，返回值为卸载函数。 */
export interface CollectorContext {
  reportError(
    type: ErrorType,
    message: string,
    detail?: { stack?: string; source?: string; properties?: Properties },
  ): void;
  pageView(path?: string, properties?: Properties): void;
  track(name: string, properties?: Properties): void;
  breadcrumb(crumb: Omit<Breadcrumb, 'ts'>): void;
  performance(metrics: Record<string, number>): void;
  /** 上报地址，用于排除 SDK 自己的请求。 */
  endpoint: string;
}

export type Teardown = () => void;
