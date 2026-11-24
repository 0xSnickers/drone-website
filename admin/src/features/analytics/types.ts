import type { Bucket } from '@/types/monitor';

export interface Totals {
  pv: number;
  uv: number;
  sessions: number;
  ips: number;
  events: number;
  errors: number;
  errorVisitors: number;
  requests: number;
  serverErrors: number;
  avgDurationMs: number;
  avgLoadMs: number;
  avgFcpMs: number;
}

export interface Overview {
  range: { from: string; to: string; bucket: Bucket };
  current: Totals;
  previous: Totals;
}

export interface TrendPoint {
  bucket: string;
  pv: number;
  uv: number;
  errors: number;
  requests: number;
  serverErrors: number;
}

export interface PageStat {
  path: string;
  pv: number;
  uv: number;
}

export interface DimensionStat {
  name: string;
  visitors: number;
  pv: number;
}

export interface Audience {
  referrers: { name: string; pv: number; uv: number }[];
  browsers: DimensionStat[];
  systems: DimensionStat[];
  devices: DimensionStat[];
}
