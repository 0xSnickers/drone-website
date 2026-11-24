import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { RangeParams } from '@/types/monitor';
import { getLogs, getLogServices, getLogStats } from '../api/logApi';
import type { LogFilters } from '../types';

export const logKeys = {
  all: ['logs'] as const,
  list: (p: RangeParams & LogFilters) => [...logKeys.all, 'list', p] as const,
  stats: (p: RangeParams & { service?: string }) => [...logKeys.all, 'stats', p] as const,
  services: () => [...logKeys.all, 'services'] as const,
};

export const useLogs = (p: RangeParams & LogFilters) =>
  useQuery({
    queryKey: logKeys.list(p),
    queryFn: () => getLogs(p),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
export const useLogStats = (p: RangeParams & { service?: string }) =>
  useQuery({
    queryKey: logKeys.stats(p),
    queryFn: () => getLogStats(p),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
export const useLogServices = () =>
  useQuery({ queryKey: logKeys.services(), queryFn: getLogServices, staleTime: 60_000 });
