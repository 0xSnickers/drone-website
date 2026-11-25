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
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data?.stressTest?.active || (data?.bottleneck && data.bottleneck.level !== 'healthy')) {
        return 2_500;
      }
      return 8_000;
    },
  });
}
