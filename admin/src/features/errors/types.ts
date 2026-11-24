import type { Named } from '@/types/monitor';

export type ErrorType = 'js' | 'promise' | 'resource' | 'api' | 'custom';
export type IssueStatus = 'open' | 'resolved' | 'ignored';
export const ISSUE_STATUSES: IssueStatus[] = ['open', 'resolved', 'ignored'];
export const ERROR_TYPES: ErrorType[] = ['js', 'promise', 'resource', 'api', 'custom'];

export interface Issue {
  id: string;
  projectId: string;
  fingerprint: string;
  type: ErrorType;
  message: string;
  source: string;
  status: IssueStatus;
  count: number;
  firstSeen: string;
  lastSeen: string;
  /** 列表接口返回：时间范围内的次数和影响访客数。 */
  rangeCount?: number;
  users?: number;
}

export interface IssueDetail extends Issue {
  trend: { bucket: string; count: number }[];
  users: number;
  browsers: Named[];
  systems: Named[];
}

export interface Breadcrumb {
  type: string;
  message: string;
  ts: number;
}

export interface ErrorOccurrence {
  id: string;
  message: string;
  stack: string;
  url: string;
  path: string;
  visitorId: string;
  userId: string | null;
  ip: string;
  browser: string;
  os: string;
  device: string;
  release: string | null;
  breadcrumbs: Breadcrumb[];
  extra: Record<string, unknown>;
  createdAt: string;
}

export interface IssueFilters {
  status?: IssueStatus;
  type?: ErrorType;
  q?: string;
  sort?: 'frequent' | 'recent';
  page?: number;
  limit?: number;
}
