import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import { useIsAdmin } from '@/features/auth';
import { useRangeParams } from '@/features/filters';
import { IpRulesCard, IpTable } from '@/features/ips';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function IpsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('ips.title'));
  const params = useRangeParams();
  const isAdmin = useIsAdmin();
  return (
    <>
      <PageHeader title={t('ips.title')} description={t('ips.description')} />
      <div className="space-y-6">
        <IpTable params={params} canEdit={isAdmin} />
        <IpRulesCard canEdit={isAdmin} />
      </div>
    </>
  );
}
