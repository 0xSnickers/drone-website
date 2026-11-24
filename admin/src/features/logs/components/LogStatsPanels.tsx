import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StateMessage } from '@/components/ui/state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useFormat } from '@/hooks/useFormat';
import { bucketOfRange, type RangeParams } from '@/types/monitor';
import { RankCard, TrendCard } from '@/features/analytics';
import { useLogStats } from '../hooks/useLogs';

/** 请求量 / 5xx 趋势（分两张图：量级不同，不共用坐标轴）、级别与状态码分布、慢接口。 */
export function LogStatsPanels({ params, service }: { params: RangeParams; service?: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const query = useLogStats({ ...params, service });
  const data = query.data;
  const bucket = bucketOfRange[params.range];
  const named = (rows: { name: string; count: number }[] | undefined) =>
    rows?.map((r) => ({ key: r.name, label: r.name, value: r.count, display: f.number(r.count) }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <TrendCard
          title={t('logs.requestTrend')}
          data={data?.trend}
          series={[{ key: 'requests', label: t('logs.calls'), color: 'series-1' }]}
          bucket={bucket}
          isFetching={query.isFetching}
          isError={query.isError}
          height={160}
        />
        <TrendCard
          title={t('logs.errorTrend')}
          data={data?.trend}
          series={[{ key: 'serverErrors', label: '5xx', color: 'series-2' }]}
          bucket={bucket}
          isFetching={query.isFetching}
          isError={query.isError}
          height={160}
        />
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <RankCard
          title={t('logs.levelDist')}
          items={data?.levels.map((l) => ({
            key: l.name,
            label: t(`logs.levels.${l.name}`, { defaultValue: l.name }),
            value: l.count,
            display: f.number(l.count),
          }))}
          isError={query.isError}
          isFetching={query.isFetching}
        />
        <RankCard
          title={t('logs.statusDist')}
          items={named(data?.statuses)}
          isError={query.isError}
          isFetching={query.isFetching}
        />
        <Card className="lg:col-span-1">
          <CardHeader title={t('logs.slowest')} />
          <CardContent className="p-0">
            {!data ? (
              <StateMessage kind={query.isError ? 'error' : 'loading'}>
                {query.isError ? t('ui.loadFailed') : t('common.loading')}
              </StateMessage>
            ) : data.slowest.length === 0 ? (
              <StateMessage kind="empty">{t('common.empty')}</StateMessage>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('logs.path')}</TableHead>
                    <TableHead className="text-right">{t('logs.p95')}</TableHead>
                    <TableHead className="text-right">{t('logs.calls')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.slowest.map((s) => (
                    <TableRow key={`${s.method} ${s.path}`}>
                      <TableCell
                        className="max-w-48 truncate font-mono text-xs"
                        title={`${s.method} ${s.path} · ${t('logs.avg')} ${f.ms(s.avgMs)}`}
                      >
                        <span className="text-muted-foreground">{s.method}</span> {s.path}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{f.ms(s.p95Ms)}</TableCell>
                      <TableCell className="text-right tabular-nums">{f.number(s.count)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
