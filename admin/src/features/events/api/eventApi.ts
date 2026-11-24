import type { PageResult } from '@/core/http/types';
import { http } from '@/services/http';
import type { RangeParams } from '@/types/monitor';
import type { EventFilters, MonitorEventRow, TrackSummary } from '../types';

export const getEvents = (params: RangeParams & EventFilters) =>
  http.get<PageResult<MonitorEventRow>>('/events', { params });
export const getEventSummary = (params: RangeParams) =>
  http.get<TrackSummary[]>('/events/summary', { params });
