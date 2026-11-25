import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Navigate, Outlet, useLocation, useSearchParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { useAuth } from '../hooks/useAuth';
import { getSafeRedirect } from '../redirect';

function FullPageLoader() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-muted-foreground">
      <Loader2 className="size-5 animate-spin" aria-label="loading" />
    </div>
  );
}

/** 需要登录的路由。未登录时跳转登录页，并带上当前地址作为 redirect。 */
export function RequireAuth() {
  const { status, user, signOut } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  if (status === 'pending') return <FullPageLoader />;

  if (status === 'anonymous') {
    const redirect = encodeURIComponent(`${location.pathname}${location.search}`);
    return <Navigate to={`/login?redirect=${redirect}`} replace />;
  }

  if (user?.role !== 'admin' && user?.role !== 'monitor_viewer') {
    return (
      <section className="mx-auto max-w-md space-y-4 p-6">
        <h1 className="text-xl font-semibold">{t('monitorAccess.deniedTitle')}</h1>
        <p role="alert" className="text-sm text-muted-foreground">
          {t('monitorAccess.deniedDescription')}
        </p>
        <Button onClick={() => void signOut().catch(() => undefined)}>{t('nav.signOut')}</Button>
      </section>
    );
  }

  return <Outlet />;
}

/** 仅未登录可访问的路由（登录、注册）。已登录时跳回 redirect 或首页。 */
export function GuestOnly() {
  const { status } = useAuth();
  const [searchParams] = useSearchParams();

  if (status === 'pending') return <FullPageLoader />;
  if (status === 'authenticated') {
    return <Navigate to={getSafeRedirect(searchParams.get('redirect'))} replace />;
  }

  return <Outlet />;
}
