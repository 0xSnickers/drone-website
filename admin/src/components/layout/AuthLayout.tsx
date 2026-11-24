import { Activity } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Outlet } from 'react-router';
import { AppControls } from './AppControls';
import { RouteTracker } from './RouteTracker';

/** 登录 / 注册页外壳。 */
export function AuthLayout() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col">
      <RouteTracker />
      <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Activity className="size-4" aria-hidden />
          </span>
          {t('common.appName')}
        </div>
        <AppControls />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center">
        <Outlet />
      </main>
    </div>
  );
}
