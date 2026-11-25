import { http } from '@/services/http';
import type {
  CreateReleaseInput,
  PageResult,
  ReleaseRecord,
  StressRunDetail,
  StressRunSummary,
} from '../types';

export function listReleases(params: { page: number; limit: number }) {
  return http.get<PageResult<ReleaseRecord>>('/releases', { params });
}

export function createRelease(input: CreateReleaseInput) {
  return http.post<ReleaseRecord>('/releases', input);
}

export function deleteRelease(id: string) {
  return http.delete<{ id: string }>(`/releases/${id}`);
}

export function listStressRuns(params: { page: number; limit: number }) {
  return http.get<PageResult<StressRunSummary>>('/stress-runs', { params });
}

export function getStressRunDetail(runId: string) {
  return http.get<StressRunDetail>(`/stress-runs/${encodeURIComponent(runId)}`);
}
