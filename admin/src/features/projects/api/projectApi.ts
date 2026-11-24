import type { PageResult } from '@/core/http/types';
import { http } from '@/services/http';
import type { Project, ProjectInput } from '../types';

export const getProjects = () =>
  http.get<PageResult<Project>>('/projects', { params: { page: 1, limit: 100 } });
export const createProject = (input: ProjectInput) => http.post<Project>('/projects', input);
export const updateProject = (id: string, input: ProjectInput) =>
  http.put<Project>(`/projects/${id}`, input);
export const rotateProjectKey = (id: string) => http.post<Project>(`/projects/${id}/rotate-key`);
export const deleteProject = (id: string) => http.delete<{ id: string }>(`/projects/${id}`);
