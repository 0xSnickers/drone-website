import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { telemetry } from '@/services/telemetry';
import {
  createProject,
  deleteProject,
  getProjects,
  rotateProjectKey,
  updateProject,
} from '../api/projectApi';
import type { ProjectInput } from '../types';

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
};

export function useProjects() {
  return useQuery({ queryKey: projectKeys.list(), queryFn: getProjects, staleTime: 60_000 });
}

export function useProjectMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: projectKeys.all });
  return {
    create: useMutation({
      mutationFn: (input: ProjectInput) => createProject(input),
      onSuccess: () => {
        telemetry.track('project_created');
        return invalidate();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ProjectInput }) => updateProject(id, input),
      onSuccess: invalidate,
    }),
    rotate: useMutation({ mutationFn: rotateProjectKey, onSuccess: invalidate }),
    remove: useMutation({ mutationFn: deleteProject, onSuccess: invalidate }),
  };
}
