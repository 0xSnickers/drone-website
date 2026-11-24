import type { Named } from '@/types/monitor';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export const LOG_LEVELS: LogLevel[] = ['debug', 'info', 'warn', 'error'];
export const STATUS_CLASSES = ['2xx', '3xx', '4xx', '5xx'] as const;
export type StatusClass = (typeof STATUS_CLASSES)[number];

export interface ServerLog {
  id: string;
  projectId: string | null;
  service: string;
  level: LogLevel;
  message: string;
  requestId: string | null;
  method: string | null;
  path: string | null;
  status: number | null;
  durationMs: number | null;
  ip: string | null;
  userAgent: string | null;
  meta: Record<string, unknown>;
  createdAt: string;
}

export interface LogStats {
  levels: Named[];
  statuses: Named[];
  trend: {
    bucket: string;
    requests: number;
    serverErrors: number;
    errors: number;
    avgMs: number;
  }[];
  slowest: {
    method: string;
    path: string;
    count: number;
    avgMs: number;
    p95Ms: number;
    serverErrors: number;
  }[];
}

export interface LogService {
  service: string;
  projectId: string | null;
  lastSeen: string;
}

export interface LogFilters {
  service?: string;
  level?: LogLevel;
  statusClass?: StatusClass;
  q?: string;
  ip?: string;
  requestId?: string;
  page?: number;
  limit?: number;
}
