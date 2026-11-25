import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { getSystemStatus } from '../api/systemApi';

export const systemKeys = {
  all: ['system'] as const,
  status: () => [...systemKeys.all, 'status'] as const,
};

export function useSystemStatus() {
  return useQuery({
    queryKey: systemKeys.status(),
    queryFn: getSystemStatus,
    placeholderData: keepPreviousData,
    refetchInterval: 15_000,
  });
}
