import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, deleteUser, listUsers, updateUser } from '../api/usersApi';
import type { CreateUserInput, UpdateUserInput } from '../types';

export const usersKeys = {
  all: ['admin-users'] as const,
  list: (page: number, limit: number) => [...usersKeys.all, 'list', page, limit] as const,
};

export function useUsers(page: number, limit = 10, enabled = true) {
  return useQuery({
    queryKey: usersKeys.list(page, limit),
    queryFn: () => listUsers({ page, limit }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useUserMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: usersKeys.all });

  return {
    create: useMutation({
      mutationFn: (input: CreateUserInput) => createUser(input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: UpdateUserInput }) => updateUser(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteUser(id),
      onSuccess: invalidate,
    }),
  };
}
