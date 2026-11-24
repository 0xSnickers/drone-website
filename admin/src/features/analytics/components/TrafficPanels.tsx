import { useTranslation } from 'react-i18next';
import { useFormat } from '@/hooks/useFormat';
import type { RangeParams } from '@/types/monitor';
import { useAudience, usePages } from '../hooks/useAnalytics';
import type { DimensionStat } from '../types';
import { RankCard } from './RankCard';

/** 热门页面（PV 排序，副值 UV）。 */
export function TopPagesCard({ params, limit = 10 }: { params: RangeParams; limit?: number }) {
  const { t } = useTranslation();
  const f = useFormat();
  const pages = usePages(params);
  return (
    <RankCard
      title={t('traffic.pages')}
      description={`${t('traffic.pv')} · ${t('traffic.uv')}`}
      isError={pages.isError}
      isFetching={pages.isFetching}
      items={pages.data?.slice(0, limit).map((p) => ({
        key: p.path,
        label: <span className="font-mono text-xs">{p.path}</span>,
        value: p.pv,
        display: f.number(p.pv),
        secondary: `${f.number(p.uv)} UV`,
      }))}
    />
  );
}

/** 来源 + 浏览器 / 系统 / 设备分布。 */
export function AudiencePanels({ params }: { params: RangeParams }) {
  const { t } = useTranslation();
  const f = useFormat();
  const audience = useAudience(params);
  const data = audience.data;
  const byVisitors = (rows: DimensionStat[] | undefined, label = (n: string) => n) =>
    rows?.map((r) => ({
      key: r.name,
      label: label(r.name),
      value: r.visitors,
      display: f.number(r.visitors),
      secondary: `${f.number(r.pv)} PV`,
    }));
  const common = {
    isError: audience.isError,
    isFetching: audience.isFetching,
    description: t('traffic.visitors'),
  };
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <RankCard
        title={t('traffic.referrers')}
        description={`${t('traffic.pv')} · ${t('traffic.uv')}`}
        isError={audience.isError}
        isFetching={audience.isFetching}
        items={data?.referrers.map((r) => ({
          key: r.name,
          label: r.name === '(direct)' ? t('traffic.direct') : r.name,
          value: r.pv,
          display: f.number(r.pv),
          secondary: `${f.number(r.uv)} UV`,
        }))}
      />
      <RankCard
        title={t('traffic.devices')}
        {...common}
        items={byVisitors(data?.devices, (n) => t(`traffic.deviceNames.${n}`, { defaultValue: n }))}
      />
      <RankCard title={t('traffic.browsers')} {...common} items={byVisitors(data?.browsers)} />
      <RankCard title={t('traffic.systems')} {...common} items={byVisitors(data?.systems)} />
    </div>
  );
}
