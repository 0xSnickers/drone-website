import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  AudiencePanels,
  OverviewTiles,
  TopPagesCard,
  TrendCard,
  useOverview,
  useTrend,
} from '@/features/analytics';
import { useRangeParams } from '@/features/filters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { bucketOfRange } from '@/types/monitor';

export function TrafficPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('traffic.title'));
  const params = useRangeParams();
  const overview = useOverview(params);
  const trend = useTrend(params);

  return (
    <>
      <PageHeader title={t('traffic.title')} description={t('traffic.description')} />
      <div className="space-y-4">
        <OverviewTiles
          overview={overview.data}
          dimmed={overview.isFetching}
          metrics={[
            'pv',
            'uv',
            'sessions',
            'ips',
            'events',
            'avgLoadMs',
            'avgFcpMs',
            'errorVisitors',
          ]}
        />
        <TrendCard
          title={t('dashboard.trafficTrend')}
          data={trend.data}
          bucket={bucketOfRange[params.range]}
          isFetching={trend.isFetching}
          isError={trend.isError}
          height={240}
          series={[
            { key: 'pv', label: t('traffic.pv'), color: 'series-1' },
            { key: 'uv', label: t('traffic.uv'), color: 'series-2' },
          ]}
        />
        <TopPagesCard params={params} limit={20} />
        <AudiencePanels params={params} />
      </div>
    </>
  );
}
