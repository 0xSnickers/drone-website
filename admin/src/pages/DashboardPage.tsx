import { ArrowRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import {
  OverviewTiles,
  TopPagesCard,
  TrendCard,
  useOverview,
  useTrend,
} from '@/features/analytics';
import { IssueList } from '@/features/errors';
import { useRangeParams } from '@/features/filters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { bucketOfRange } from '@/types/monitor';

export function DashboardPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('dashboard.title'));
  const params = useRangeParams();
  const overview = useOverview(params);
  const trend = useTrend(params);
  const bucket = bucketOfRange[params.range];
  const trendProps = {
    data: trend.data,
    bucket,
    isFetching: trend.isFetching,
    isError: trend.isError,
    height: 170,
  };

  return (
    <>
      <PageHeader title={t('dashboard.title')} description={t('dashboard.description')} />
      <div className="space-y-4">
        <OverviewTiles
          overview={overview.data}
          dimmed={overview.isFetching}
          metrics={[
            'pv',
            'uv',
            'errors',
            'errorVisitors',
            'requests',
            'serverErrorRate',
            'avgDurationMs',
            'avgLoadMs',
          ]}
        />
        <TrendCard
          title={t('dashboard.trafficTrend')}
          {...trendProps}
          height={220}
          series={[
            { key: 'pv', label: t('traffic.pv'), color: 'series-1' },
            { key: 'uv', label: t('traffic.uv'), color: 'series-2' },
          ]}
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <TrendCard
            title={t('dashboard.errorTrend')}
            {...trendProps}
            series={[{ key: 'errors', label: t('dashboard.errors'), color: 'series-2' }]}
          />
          <TrendCard
            title={t('dashboard.requestTrend')}
            {...trendProps}
            series={[{ key: 'requests', label: t('dashboard.requests'), color: 'series-1' }]}
          />
          <TrendCard
            title={t('dashboard.serverErrorTrend')}
            {...trendProps}
            series={[{ key: 'serverErrors', label: '5xx', color: 'series-2' }]}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <section className="min-w-0 space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t('dashboard.topIssues')}</h2>
              <Button asChild variant="ghost" size="sm">
                <Link to="/errors">
                  {t('dashboard.viewAll')}
                  <ArrowRight />
                </Link>
              </Button>
            </div>
            <IssueList params={params} compact />
          </section>
          <TopPagesCard params={params} limit={8} />
        </div>
      </div>
    </>
  );
}
