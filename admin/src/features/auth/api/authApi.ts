import type { AuthSession, LoginInput, RegisterInput, User } from '@/core/auth/types';
import { unwrapApiResponse } from '@/core/http/createHttpClient';
import { singleFlight } from '@/core/utils/singleFlight';
import { http, tokenStore } from '@/services/http';

export function login(input: LoginInput) {
  return http.post<AuthSession>('/admin/auth/login', input);
}

export function register(input: RegisterInput) {
  return http.post<AuthSession>('/auth/register', input);
}

export function logout() {
  return http.post<{ success: boolean }>('/admin/auth/logout');
}

export function getCurrentUser() {
  return http.get<User>('/admin/auth/me');
}

/**
 * 使用 HttpOnly Cookie（admin_refresh_token）中的管理端刷新凭证换取新的 accessToken。
 * 与前台 web 的 refresh_token Cookie 完全隔离。
 * 并发调用（启动恢复会话 + 多个 401 请求）只会发出一次刷新请求。
 */
export const refreshSession = singleFlight(async () => {
  const response = await http.bare.post('/admin/auth/refresh');
  const session = unwrapApiResponse<AuthSession>(response.data);
  tokenStore.set(session.accessToken);
  return session;
});
