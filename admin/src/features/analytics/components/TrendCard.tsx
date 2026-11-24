import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ChartCard } from '@/components/charts/chart-card';
import { LineChart, type LineSeries } from '@/components/charts/line-chart';
import { SeriesTable } from '@/components/charts/series-table';
import { StateMessage } from '@/components/ui/state';
import { useFormat } from '@/hooks/useFormat';
import type { Bucket } from '@/types/monitor';

interface TrendCardProps<K extends string> {
  title: ReactNode;
  description?: ReactNode;
  data: ({ bucket: string } & Record<K, number>)[] | undefined;
  series: LineSeries<K>[];
  bucket: Bucket;
  isFetching?: boolean;
  isError?: boolean;
  formatValue?(value: number): string;
  height?: number;
}

/** 时间序列卡片：折线图 + 表格视图，加载 / 失败有占位。 */
export function TrendCard<K extends string>({
  title,
  description,
  data,
  series,
  bucket,
  isFetching,
  isError,
  formatValue,
  height,
}: TrendCardProps<K>) {
  const { t } = useTranslation();
  const f = useFormat();
  const value = formatValue ?? f.number;
  const body = (view: 'chart' | 'table') => {
    if (!data)
      return (
        <StateMessage kind={isError ? 'error' : 'loading'}>
          {isError ? t('ui.loadFailed') : t('common.loading')}
        </StateMessage>
      );
    return view === 'chart' ? (
      <LineChart
        data={data}
        series={series}
        ariaLabel={typeof title === 'string' ? title : 'trend'}
        formatX={(b) => f.bucket(b, bucket)}
        formatTooltipX={(b) => f.bucketLong(b, bucket)}
        formatValue={value}
        formatTick={f.compact}
        dimmed={isFetching}
        height={height}
      />
    ) : (
      <SeriesTable
        data={data}
        series={series}
        timeLabel={t('ui.time')}
        formatX={(b) => f.bucketLong(b, bucket)}
        formatValue={value}
      />
    );
  };
  return (
    <ChartCard
      title={title}
      description={description}
      chart={body('chart')}
      table={body('table')}
      labels={{ chart: t('ui.chart'), table: t('ui.table') }}
    />
  );
}
