import type { Named } from '@/types/monitor';

export interface IpSummary {
  ip: string;
  total: number;
  pageviews: number;
  events: number;
  errors: number;
  requests: number;
  visitors: number;
  firstSeen: string;
  lastSeen: string;
  blocked: boolean;
}

export interface IpDetail {
  summary: IpSummary | null;
  trend: { bucket: string; count: number }[];
  pages: Named[];
  agents: Named[];
  visitors: Named[];
  errors: { id: string; issueId: string; message: string; path: string; createdAt: string }[];
  requests: {
    id: string;
    service: string;
    method: string | null;
    path: string | null;
    status: number | null;
    durationMs: number | null;
    createdAt: string;
  }[];
}

export interface IpRule {
  id: string;
  ip: string;
  note: string;
  createdAt: string;
}
