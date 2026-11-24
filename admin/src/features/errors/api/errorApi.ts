import type { PageResult } from '@/core/http/types';
import { http } from '@/services/http';
import type { RangeParams } from '@/types/monitor';
import type { ErrorOccurrence, Issue, IssueDetail, IssueFilters, IssueStatus } from '../types';

export const getIssues = (params: RangeParams & IssueFilters) =>
  http.get<PageResult<Issue>>('/errors/issues', { params });
export const getIssue = (id: string, params: RangeParams) =>
  http.get<IssueDetail>(`/errors/issues/${id}`, { params });
export const getIssueEvents = (id: string, page: number) =>
  http.get<PageResult<ErrorOccurrence>>(`/errors/issues/${id}/events`, {
    params: { page, limit: 10 },
  });
export const updateIssueStatus = (id: string, status: IssueStatus) =>
  http.put<Issue>(`/errors/issues/${id}`, { status });
