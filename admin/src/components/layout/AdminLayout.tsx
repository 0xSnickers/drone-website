import { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bug,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  MousePointerClick,
  Network,
  ScrollText,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { NavLink, Outlet } from 'react-router';
import { cn } from '@/core/utils/cn';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth';
import { FilterBar } from '@/features/filters';
import { AppControls } from './AppControls';
import { RouteTracker } from './RouteTracker';

const groups = [
  {
    labelKey: 'nav.groupMonitor',
    items: [
      { to: '/', labelKey: 'nav.dashboard', icon: LayoutDashboard, end: true },
      { to: '/traffic', labelKey: 'nav.traffic', icon: BarChart3 },
      { to: '/events', labelKey: 'nav.events', icon: MousePointerClick },
      { to: '/errors', labelKey: 'nav.errors', icon: Bug },
      { to: '/logs', labelKey: 'nav.logs', icon: ScrollText },
      { to: '/ips', labelKey: 'nav.ips', icon: Network },
    ],
  },
  {
    labelKey: 'nav.groupSettings',
    items: [{ to: '/projects', labelKey: 'nav.projects', icon: FolderKanban }],
  },
] as const;

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const { t } = useTranslation();
  return (
    <nav className="space-y-6 text-sm">
      {groups.map((group) => (
        <div key={group.labelKey} className="space-y-1">
          <p className="px-3 text-xs font-medium text-muted-foreground">{t(group.labelKey)}</p>
          {group.items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2.5 rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
                  isActive && 'bg-accent font-medium text-foreground',
                )
              }
            >
              <item.icon className="size-4" aria-hidden />
              {t(item.labelKey)}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

function Brand() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 px-3 font-semibold">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Activity className="size-4" aria-hidden />
      </span>
      {t('common.appName')}
    </div>
  );
}

/** 后台外壳：左侧导航（窄屏为抽屉）、顶部全局筛选 + 偏好 + 用户。 */
export function AdminLayout() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[15rem_1fr]">
      <RouteTracker />
      <div className="hidden border-r bg-background lg:block">
        <aside className="sticky top-0 flex h-screen flex-col gap-6 px-3 py-4">
          <Brand />
          <SideNav />
        </aside>
      </div>

      {open ? (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label={t('common.cancel')}
            className="absolute inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col gap-6 border-r bg-background px-3 py-4">
            <div className="flex items-center justify-between">
              <Brand />
              <Button
                variant="ghost"
                size="icon"
                aria-label={t('common.cancel')}
                onClick={() => setOpen(false)}
              >
                <X />
              </Button>
            </div>
            <SideNav onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                className="lg:hidden"
                aria-label={t('nav.openMenu')}
                onClick={() => setOpen(true)}
              >
                <Menu />
              </Button>
              <FilterBar />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <AppControls />
              {user ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="hidden text-muted-foreground sm:inline">{user.name}</span>
                  <Button variant="ghost" size="sm" onClick={() => void signOut()}>
                    <LogOut />
                    <span className="sr-only sm:not-sr-only">{t('nav.signOut')}</span>
                  </Button>
                </div>
              ) : null}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
