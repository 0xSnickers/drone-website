import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { useRangeParams } from '@/features/filters';
import { LogStatsPanels, LogTable, useLogServices } from '@/features/logs';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function LogsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('logs.title'));
  const params = useRangeParams();
  const services = useLogServices();
  const [search, setSearch] = useSearchParams();
  const service = search.get('service') ?? undefined;
  const names = [...new Set((services.data ?? []).map((s) => s.service))];

  return (
    <>
      <PageHeader title={t('logs.title')} description={t('logs.description')} />
      <div className="space-y-6">
        <LogStatsPanels params={params} service={service} />
        <LogTable
          params={params}
          service={service}
          services={names}
          onServiceChange={(value) => setSearch(value ? { service: value } : {}, { replace: true })}
        />
      </div>
    </>
  );
}
