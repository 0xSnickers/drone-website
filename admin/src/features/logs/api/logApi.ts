import type { PageResult } from '@/core/http/types';
import { http } from '@/services/http';
import type { RangeParams } from '@/types/monitor';
import type { LogFilters, LogService, LogStats, ServerLog } from '../types';

export const getLogs = (params: RangeParams & LogFilters) =>
  http.get<PageResult<ServerLog>>('/logs', { params });
export const getLogStats = (params: RangeParams & { service?: string }) =>
  http.get<LogStats>('/logs/stats', { params });
export const getLogServices = () => http.get<LogService[]>('/logs/services');
