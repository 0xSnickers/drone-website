import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { RangeParams } from '@/types/monitor';
import { getAudience, getOverview, getPages, getTrend } from '../api/analyticsApi';

export const analyticsKeys = {
  all: ['analytics'] as const,
  overview: (p: RangeParams) => [...analyticsKeys.all, 'overview', p] as const,
  trend: (p: RangeParams) => [...analyticsKeys.all, 'trend', p] as const,
  pages: (p: RangeParams) => [...analyticsKeys.all, 'pages', p] as const,
  audience: (p: RangeParams) => [...analyticsKeys.all, 'audience', p] as const,
};

/** 刷新时保留上一份数据（图表半透明而不是闪烁），每分钟自动刷新。 */
const live = { placeholderData: keepPreviousData, refetchInterval: 60_000 } as const;

export const useOverview = (p: RangeParams) =>
  useQuery({ queryKey: analyticsKeys.overview(p), queryFn: () => getOverview(p), ...live });
export const useTrend = (p: RangeParams) =>
  useQuery({ queryKey: analyticsKeys.trend(p), queryFn: () => getTrend(p), ...live });
export const usePages = (p: RangeParams) =>
  useQuery({ queryKey: analyticsKeys.pages(p), queryFn: () => getPages(p), ...live });
export const useAudience = (p: RangeParams) =>
  useQuery({ queryKey: analyticsKeys.audience(p), queryFn: () => getAudience(p), ...live });
