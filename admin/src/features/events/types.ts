export type EventType = 'pageview' | 'track' | 'performance';

export interface MonitorEventRow {
  id: string;
  projectId: string;
  type: EventType;
  name: string;
  url: string;
  path: string;
  referrer: string;
  visitorId: string;
  sessionId: string;
  userId: string | null;
  ip: string;
  browser: string;
  os: string;
  device: string;
  release: string | null;
  properties: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
}

export interface TrackSummary {
  name: string;
  count: number;
  visitors: number;
  lastSeen: string;
}

export interface EventFilters {
  type?: EventType;
  name?: string;
  visitorId?: string;
  ip?: string;
  page?: number;
  limit?: number;
}
