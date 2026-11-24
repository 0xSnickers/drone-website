import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { telemetry } from '@/services/telemetry';
import type { RangeParams } from '@/types/monitor';
import { blockIp, getIpDetail, getIpRules, getIps, unblockIp } from '../api/ipApi';

type IpListParams = RangeParams & { q?: string; page?: number; limit?: number };

export const ipKeys = {
  all: ['ips'] as const,
  list: (p: IpListParams) => [...ipKeys.all, 'list', p] as const,
  detail: (ip: string, p: RangeParams) => [...ipKeys.all, 'detail', ip, p] as const,
  rules: () => [...ipKeys.all, 'rules'] as const,
};

export const useIps = (p: IpListParams) =>
  useQuery({
    queryKey: ipKeys.list(p),
    queryFn: () => getIps(p),
    placeholderData: keepPreviousData,
  });
export const useIpDetail = (ip: string, p: RangeParams) =>
  useQuery({
    queryKey: ipKeys.detail(ip, p),
    queryFn: () => getIpDetail(ip, p),
    placeholderData: keepPreviousData,
  });
export const useIpRules = () => useQuery({ queryKey: ipKeys.rules(), queryFn: getIpRules });

export function useIpRuleMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ipKeys.all });
  return {
    block: useMutation({
      mutationFn: ({ ip, note }: { ip: string; note?: string }) => blockIp(ip, note),
      onSuccess: () => {
        telemetry.track('ip_blocked');
        return invalidate();
      },
    }),
    unblock: useMutation({ mutationFn: unblockIp, onSuccess: invalidate }),
  };
}
