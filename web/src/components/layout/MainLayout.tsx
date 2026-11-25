import {
  Compass,
  GraduationCap,
  Home,
  LogIn,
  PlaneTakeoff,
  SlidersHorizontal,
  Store,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, NavLink, Outlet, useLocation } from 'react-router';
import { AeroLogo } from '@/components/ui/aero-logo';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/core/utils/cn';
import { useAuth } from '@/features/auth';
import { CartHeaderButton, CartToast } from '@/features/store';
import { AppControls } from './AppControls';
import { RouteTracker } from './RouteTracker';

const mainTabs = [
  { to: '/', labelKey: 'nav.home', icon: Home, end: true },
  { to: '/flagship', labelKey: 'nav.flagship', icon: PlaneTakeoff, end: false },
  { to: '/academy', labelKey: 'nav.academy', icon: GraduationCap, end: false },
  { to: '/community', labelKey: 'nav.community', icon: Compass, end: false },
  { to: '/store', labelKey: 'nav.store', icon: Store, end: false },
] as const;

function resolveSubtitleKey(pathname: string): string {
  if (pathname.startsWith('/flagship')) return 'nav.subtitles.flagship';
  if (pathname.startsWith('/academy')) return 'nav.subtitles.academy';
  if (pathname.startsWith('/community')) return 'nav.subtitles.community';
  if (pathname.startsWith('/store')) return 'nav.subtitles.store';
  if (
    pathname.startsWith('/profile') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  ) {
    return 'nav.subtitles.account';
  }
  return 'nav.subtitles.home';
}

export function MainLayout() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const { status, user } = useAuth();
  const subtitleKey = resolveSubtitleKey(pathname);

  return (
    <div className="min-h-screen bg-surface text-foreground selection:bg-primary selection:text-primary-foreground">
      <RouteTracker />

      {/* Top Aerospace HUD Header */}
      <header className="fixed top-0 z-50 w-full border-b border-border/60 bg-surface-lowest/85 backdrop-blur-xl pt-safe">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-5">
          <Link to="/" className="flex items-center gap-2.5">
            <AeroLogo />
            <div className="flex flex-col">
              <span className="font-display text-lg leading-tight font-bold tracking-wider text-primary uppercase">
                {t('common.appName')}
              </span>
              <span className="font-mono text-[10px] leading-tight font-semibold tracking-widest text-muted-foreground">
                {t(subtitleKey)}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
            {mainTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <NavLink
                  key={tab.to}
                  to={tab.to}
                  end={tab.end}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all',
                      isActive
                        ? 'bg-surface-high text-primary glow-primary-sm'
                        : 'text-muted-foreground hover:bg-surface-low hover:text-foreground',
                    )
                  }
                >
                  <Icon className="size-4" />
                  <span>{t(tab.labelKey)}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Header Actions: Preferences + Shopping Bag + Pilot Profile */}
          <div className="flex items-center gap-1">
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  aria-label={t('nav.preferences')}
                  className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-high hover:text-primary"
                >
                  <SlidersHorizontal className="size-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="border-border bg-card sm:max-w-md">
                <DialogHeader>
                  <DialogTitle className="font-display text-lg">
                    {t('cart.PreferencesTitle')}
                  </DialogTitle>
                  <DialogDescription>{t('cart.PreferencesDesc')}</DialogDescription>
                </DialogHeader>
                <AppControls />
              </DialogContent>
            </Dialog>

            <CartHeaderButton />

            {status === 'authenticated' && user ? (
              <Link
                to="/profile"
                aria-label={t('nav.profile')}
                className="ml-1 flex h-9 items-center gap-2 rounded-full bg-surface-high px-2.5 text-xs font-semibold text-primary ring-1 ring-primary/35 transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <UserRound className="size-4 shrink-0" />
                <span className="hidden max-w-24 truncate sm:inline">{user.name}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                aria-label={t('auth.login.submit')}
                className="ml-1 flex h-9 items-center gap-1.5 rounded-full bg-surface-high px-3 text-xs font-semibold text-primary ring-1 ring-primary/35 transition-colors hover:bg-primary hover:text-primary-foreground"
              >
                <LogIn className="size-3.5 shrink-0" />
                <span className="hidden sm:inline">{t('auth.login.submit')}</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto min-h-screen w-full max-w-5xl pt-16 pb-20 md:pb-10">
        <Outlet />
      </main>

      <CartToast />

      {/* Bottom Floating Flight HUD Tab Bar (Mobile) */}
      <nav
        aria-label="Mobile"
        className="fixed bottom-0 z-50 w-full border-t border-border/60 bg-surface-lowest/90 backdrop-blur-2xl pb-safe md:hidden"
      >
        <div className="flex h-16 items-stretch justify-around px-3">
          {mainTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <NavLink
                key={tab.to}
                to={tab.to}
                end={tab.end}
                className={({ isActive }) =>
                  cn(
                    'relative flex min-h-11 min-w-11 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors',
                    isActive
                      ? "text-primary after:absolute after:top-0 after:h-0.5 after:w-8 after:bg-primary after:content-['']"
                      : 'text-muted-foreground hover:text-foreground',
                  )
                }
              >
                <Icon className="size-5" />
                <span className="scale-90">{t(tab.labelKey)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
