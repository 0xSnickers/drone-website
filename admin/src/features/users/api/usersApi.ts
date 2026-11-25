import { http } from '@/services/http';
import type { AdminUser, CreateUserInput, UpdateUserInput, UserPageResult } from '../types';

export function listUsers(params: { page: number; limit: number }) {
  return http.get<UserPageResult>('/users', { params });
}

export function createUser(input: CreateUserInput) {
  return http.post<AdminUser>('/users', input);
}

export function updateUser(id: string, input: UpdateUserInput) {
  return http.put<AdminUser>(`/users/${id}`, input);
}

export function deleteUser(id: string) {
  return http.delete<{ id: string }>(`/users/${id}`);
}
