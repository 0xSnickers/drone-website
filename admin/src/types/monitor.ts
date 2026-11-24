/** 跨模块共享的监控类型（与 monitor-server 接口一致）。 */
export const RANGES = ['1h', '24h', '7d', '30d'] as const;
export type RangeKey = (typeof RANGES)[number];
export type Bucket = 'minute' | 'hour' | 'day';

/** 所有统计接口共用的查询参数。 */
export interface RangeParams {
  projectId?: string;
  range: RangeKey;
  tz: string;
}

export interface Named {
  name: string;
  count: number;
}

export const bucketOfRange: Record<RangeKey, Bucket> = {
  '1h': 'minute',
  '24h': 'hour',
  '7d': 'day',
  '30d': 'day',
};
