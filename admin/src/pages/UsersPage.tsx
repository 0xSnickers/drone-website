import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { useIsAdmin } from '@/features/auth';
import { UsersPanel } from '@/features/users';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function UsersPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('users.title'));
  const isAdmin = useIsAdmin();

  return (
    <>
      <PageHeader title={t('users.title')} description={t('users.description')} />
      <UsersPanel canEdit={isAdmin} />
    </>
  );
}
