import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { RangeParams } from '@/types/monitor';
import { getEvents, getEventSummary } from '../api/eventApi';
import type { EventFilters } from '../types';

export const eventKeys = {
  all: ['events'] as const,
  list: (p: RangeParams & EventFilters) => [...eventKeys.all, 'list', p] as const,
  summary: (p: RangeParams) => [...eventKeys.all, 'summary', p] as const,
};

export const useEvents = (p: RangeParams & EventFilters) =>
  useQuery({
    queryKey: eventKeys.list(p),
    queryFn: () => getEvents(p),
    placeholderData: keepPreviousData,
  });
export const useEventSummary = (p: RangeParams) =>
  useQuery({
    queryKey: eventKeys.summary(p),
    queryFn: () => getEventSummary(p),
    placeholderData: keepPreviousData,
  });
