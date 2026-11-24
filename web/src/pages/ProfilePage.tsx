import { LogOut } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/features/auth';
import { UserListPanel } from '@/features/users';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/** 需要登录的页面（在 router.tsx 的 RequireAuth 分组中注册）。 */
export function ProfilePage() {
  const { t } = useTranslation();
  const { user, signOut } = useAuth();
  useDocumentTitle(t('profile.title'));

  if (!user) return null;

  return (
    <section className="space-y-6 px-5 py-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">{t('profile.title')}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t('profile.description')}</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void signOut()}>
          <LogOut />
          {t('home.logout')}
        </Button>
      </div>
      <dl className="grid max-w-md grid-cols-[max-content_1fr] gap-x-6 gap-y-2 rounded-lg border bg-card p-4 text-sm">
        <dt className="text-muted-foreground">{t('profile.fields.id')}</dt>
        <dd className="font-mono text-xs">{user.id}</dd>
        <dt className="text-muted-foreground">{t('auth.fields.name')}</dt>
        <dd>{user.name}</dd>
        <dt className="text-muted-foreground">{t('auth.fields.email')}</dt>
        <dd>{user.email ?? '—'}</dd>
        <dt className="text-muted-foreground">{t('profile.fields.role')}</dt>
        <dd className="font-mono text-xs text-primary uppercase">{user.role}</dd>
      </dl>
      <UserListPanel />
    </section>
  );
}
