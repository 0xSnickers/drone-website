import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { useIsAdmin } from '@/features/auth';
import { OpsCenterPanel } from '@/features/ops';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function OpsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('ops.title'));
  const isAdmin = useIsAdmin();

  return (
    <>
      <PageHeader title={t('ops.title')} description={t('ops.description')} />
      <OpsCenterPanel canEdit={isAdmin} />
    </>
  );
}
