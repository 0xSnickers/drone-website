import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { telemetry } from '@/services/telemetry';
import type { RangeParams } from '@/types/monitor';
import { getIssue, getIssueEvents, getIssues, updateIssueStatus } from '../api/errorApi';
import type { IssueFilters, IssueStatus } from '../types';

export const issueKeys = {
  all: ['issues'] as const,
  list: (p: RangeParams & IssueFilters) => [...issueKeys.all, 'list', p] as const,
  detail: (id: string, p: RangeParams) => [...issueKeys.all, 'detail', id, p] as const,
  events: (id: string, page: number) => [...issueKeys.all, 'events', id, page] as const,
};

export const useIssues = (p: RangeParams & IssueFilters) =>
  useQuery({
    queryKey: issueKeys.list(p),
    queryFn: () => getIssues(p),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });
export const useIssue = (id: string, p: RangeParams) =>
  useQuery({
    queryKey: issueKeys.detail(id, p),
    queryFn: () => getIssue(id, p),
    placeholderData: keepPreviousData,
  });
export const useIssueEvents = (id: string, page: number) =>
  useQuery({
    queryKey: issueKeys.events(id, page),
    queryFn: () => getIssueEvents(id, page),
    placeholderData: keepPreviousData,
  });

export function useUpdateIssueStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: IssueStatus }) =>
      updateIssueStatus(id, status),
    onSuccess: (_issue, { status }) => {
      telemetry.track('issue_status_changed', { status });
      return queryClient.invalidateQueries({ queryKey: issueKeys.all });
    },
  });
}
