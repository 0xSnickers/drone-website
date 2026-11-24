import { useTranslation } from 'react-i18next';
import { StatTile } from '@/components/charts/stat-tile';
import { useFormat } from '@/hooks/useFormat';
import { changeRatio } from '@/lib/format';
import type { Overview, Totals } from '../types';

export type MetricKey = keyof Totals | 'serverErrorRate';

type Formatter = ReturnType<typeof useFormat>;
const METRICS: Record<
  MetricKey,
  { labelKey: string; upIsGood: boolean; format: (f: Formatter, v: number) => string }
> = {
  pv: { labelKey: 'dashboard.pv', upIsGood: true, format: (f, v) => f.compact(v) },
  uv: { labelKey: 'dashboard.uv', upIsGood: true, format: (f, v) => f.compact(v) },
  sessions: { labelKey: 'dashboard.sessions', upIsGood: true, format: (f, v) => f.compact(v) },
  ips: { labelKey: 'dashboard.ips', upIsGood: true, format: (f, v) => f.compact(v) },
  events: { labelKey: 'events.count', upIsGood: true, format: (f, v) => f.compact(v) },
  errors: { labelKey: 'dashboard.errors', upIsGood: false, format: (f, v) => f.compact(v) },
  errorVisitors: {
    labelKey: 'dashboard.errorVisitors',
    upIsGood: false,
    format: (f, v) => f.compact(v),
  },
  requests: { labelKey: 'dashboard.requests', upIsGood: true, format: (f, v) => f.compact(v) },
  serverErrors: {
    labelKey: 'dashboard.serverErrorTrend',
    upIsGood: false,
    format: (f, v) => f.compact(v),
  },
  serverErrorRate: {
    labelKey: 'dashboard.serverErrorRate',
    upIsGood: false,
    format: (f, v) => f.percent(v, 2),
  },
  avgDurationMs: { labelKey: 'dashboard.avgDuration', upIsGood: false, format: (f, v) => f.ms(v) },
  avgLoadMs: { labelKey: 'dashboard.avgLoad', upIsGood: false, format: (f, v) => f.ms(v) },
  avgFcpMs: { labelKey: 'traffic.fcp', upIsGood: false, format: (f, v) => f.ms(v) },
};

const valueOf = (totals: Totals, key: MetricKey) =>
  key === 'serverErrorRate'
    ? totals.requests
      ? totals.serverErrors / totals.requests
      : 0
    : totals[key];

/** 一排指标卡，带「较上期」环比。 */
export function OverviewTiles({
  overview,
  metrics,
  dimmed,
}: {
  overview: Overview | undefined;
  metrics: MetricKey[];
  dimmed?: boolean;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {metrics.map((key) => {
        const spec = METRICS[key];
        const current = overview ? valueOf(overview.current, key) : 0;
        const previous = overview ? valueOf(overview.previous, key) : 0;
        return (
          <StatTile
            key={key}
            label={t(spec.labelKey)}
            value={overview ? spec.format(f, current) : '—'}
            change={overview ? changeRatio(current, previous) : null}
            upIsGood={spec.upIsGood}
            formatChange={(r) => f.percent(Math.abs(r), 0)}
            compareLabel={t('ui.vsPrevious')}
            noChangeLabel={t('ui.noChange')}
            dimmed={dimmed}
          />
        );
      })}
    </div>
  );
}
