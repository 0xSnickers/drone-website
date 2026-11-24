import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { IssueList } from '@/features/errors';
import { useRangeParams } from '@/features/filters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function ErrorsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('errors.title'));
  const params = useRangeParams();
  return (
    <>
      <PageHeader title={t('errors.title')} description={t('errors.description')} />
      <IssueList params={params} />
    </>
  );
}
