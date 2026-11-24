import { http } from '@/services/http';
import type { RangeParams } from '@/types/monitor';
import type { Audience, Overview, PageStat, TrendPoint } from '../types';

export const getOverview = (params: RangeParams) =>
  http.get<Overview>('/analytics/overview', { params });
export const getTrend = (params: RangeParams) =>
  http.get<TrendPoint[]>('/analytics/trend', { params });
export const getPages = (params: RangeParams) =>
  http.get<PageStat[]>('/analytics/pages', { params });
export const getAudience = (params: RangeParams) =>
  http.get<Audience>('/analytics/audience', { params });
