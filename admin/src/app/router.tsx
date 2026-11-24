import type { ComponentType } from 'react';
import { createBrowserRouter } from 'react-router';
import { RouteErrorPage } from '@/components/error/RouteErrorPage';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { GuestOnly, RequireAuth } from '@/features/auth';
import { NotFoundPage } from '@/pages/NotFoundPage';

const page = (load: () => Promise<{ Component: ComponentType }>) => ({ lazy: load });

/**
 * 路由表。页面使用 lazy 按需加载：
 * - 仅游客：登录、注册（AuthLayout）
 * - 需要登录：全部监控页面（AdminLayout，含全局筛选）
 */
export const router = createBrowserRouter([
  {
    errorElement: <RouteErrorPage />,
    // 首屏懒加载页面时的占位（会话恢复期间由路由守卫显示加载态）。
    HydrateFallback: () => null,
    children: [
      {
        element: <GuestOnly />,
        children: [
          {
            element: <AuthLayout />,
            children: [
              {
                path: 'login',
                ...page(async () => ({ Component: (await import('@/pages/LoginPage')).LoginPage })),
              },
              {
                path: 'register',
                ...page(async () => ({
                  Component: (await import('@/pages/RegisterPage')).RegisterPage,
                })),
              },
            ],
          },
        ],
      },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AdminLayout />,
            children: [
              {
                index: true,
                ...page(async () => ({
                  Component: (await import('@/pages/DashboardPage')).DashboardPage,
                })),
              },
              {
                path: 'traffic',
                ...page(async () => ({
                  Component: (await import('@/pages/TrafficPage')).TrafficPage,
                })),
              },
              {
                path: 'events',
                ...page(async () => ({
                  Component: (await import('@/pages/EventsPage')).EventsPage,
                })),
              },
              {
                path: 'errors',
                ...page(async () => ({
                  Component: (await import('@/pages/ErrorsPage')).ErrorsPage,
                })),
              },
              {
                path: 'errors/:id',
                ...page(async () => ({
                  Component: (await import('@/pages/ErrorDetailPage')).ErrorDetailPage,
                })),
              },
              {
                path: 'logs',
                ...page(async () => ({ Component: (await import('@/pages/LogsPage')).LogsPage })),
              },
              {
                path: 'ips',
                ...page(async () => ({ Component: (await import('@/pages/IpsPage')).IpsPage })),
              },
              {
                path: 'ips/:ip',
                ...page(async () => ({
                  Component: (await import('@/pages/IpDetailPage')).IpDetailPage,
                })),
              },
              {
                path: 'projects',
                ...page(async () => ({
                  Component: (await import('@/pages/ProjectsPage')).ProjectsPage,
                })),
              },
              { path: '*', Component: NotFoundPage },
            ],
          },
        ],
      },
    ],
  },
]);
