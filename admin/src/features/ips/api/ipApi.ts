import type { PageResult } from '@/core/http/types';
import { http } from '@/services/http';
import type { RangeParams } from '@/types/monitor';
import type { IpDetail, IpRule, IpSummary } from '../types';

export const getIps = (params: RangeParams & { q?: string; page?: number; limit?: number }) =>
  http.get<PageResult<IpSummary>>('/ips', { params });
export const getIpDetail = (ip: string, params: RangeParams) =>
  http.get<IpDetail>(`/ips/${encodeURIComponent(ip)}`, { params });
export const getIpRules = () => http.get<IpRule[]>('/ip-rules');
export const blockIp = (ip: string, note?: string) => http.post<IpRule>('/ip-rules', { ip, note });
export const unblockIp = (id: string) => http.delete<{ id: string }>(`/ip-rules/${id}`);
