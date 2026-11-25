import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createRelease,
  deleteRelease,
  getStressRunDetail,
  listReleases,
  listStressRuns,
} from '../api/opsApi';
import type { CreateReleaseInput } from '../types';

export const opsKeys = {
  releases: (page: number, limit: number) => ['ops', 'releases', page, limit] as const,
  releasesAll: ['ops', 'releases'] as const,
  stressRuns: (page: number, limit: number) => ['ops', 'stress-runs', page, limit] as const,
  stressDetail: (runId: string) => ['ops', 'stress-runs', 'detail', runId] as const,
};

export function useReleases(page: number, limit = 10) {
  return useQuery({
    queryKey: opsKeys.releases(page, limit),
    queryFn: () => listReleases({ page, limit }),
    placeholderData: keepPreviousData,
  });
}

export function useReleaseMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: opsKeys.releasesAll });
  return {
    create: useMutation({
      mutationFn: (input: CreateReleaseInput) => createRelease(input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteRelease(id),
      onSuccess: invalidate,
    }),
  };
}

export function useStressRuns(page: number, limit = 10) {
  return useQuery({
    queryKey: opsKeys.stressRuns(page, limit),
    queryFn: () => listStressRuns({ page, limit }),
    placeholderData: keepPreviousData,
  });
}

export function useStressRunDetail(runId: string | null) {
  return useQuery({
    queryKey: opsKeys.stressDetail(runId ?? ''),
    queryFn: () => getStressRunDetail(runId!),
    enabled: Boolean(runId),
  });
}
