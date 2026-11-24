import { CheckCircle2, EyeOff, RotateCcw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { BarList } from '@/components/charts/bar-list';
import { StatTile } from '@/components/charts/stat-tile';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StateMessage } from '@/components/ui/state';
import { getErrorMessage } from '@/core/http/apiError';
import { useFormat } from '@/hooks/useFormat';
import { bucketOfRange, type Named, type RangeParams } from '@/types/monitor';
import { TrendCard } from '@/features/analytics';
import { useIssue, useUpdateIssueStatus } from '../hooks/useIssues';
import type { IssueStatus } from '../types';
import { ErrorTypeBadge, IssueStatusBadge } from './IssueBadges';
import { OccurrencePanel } from './OccurrencePanel';

function Distribution({ title, rows }: { title: string; rows: Named[] }) {
  const f = useFormat();
  return (
    <Card>
      <CardHeader title={title} />
      <CardContent>
        <BarList
          items={rows.map((r) => ({
            key: r.name,
            label: r.name,
            value: r.count,
            display: f.number(r.count),
          }))}
        />
      </CardContent>
    </Card>
  );
}

/** 单个异常问题：概要、状态操作、趋势、分布、发生现场。 */
export function IssueDetailView({
  issueId,
  params,
  canEdit,
}: {
  issueId: string;
  params: RangeParams;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const query = useIssue(issueId, params);
  const update = useUpdateIssueStatus();
  const issue = query.data;

  if (!issue) {
    return (
      <StateMessage kind={query.isError ? 'error' : 'loading'}>
        {query.isError ? getErrorMessage(query.error, t('ui.loadFailed')) : t('common.loading')}
      </StateMessage>
    );
  }

  const action = (
    status: IssueStatus,
    label: string,
    Icon: typeof CheckCircle2,
    variant: 'default' | 'outline' = 'outline',
  ) => (
    <Button
      variant={variant}
      size="sm"
      disabled={!canEdit || update.isPending}
      title={canEdit ? undefined : t('ui.adminOnly')}
      onClick={() => update.mutate({ id: issue.id, status })}
    >
      <Icon />
      {label}
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <ErrorTypeBadge type={issue.type} />
          <IssueStatusBadge status={issue.status} />
        </div>
        <h1 className="text-lg font-semibold break-all">{issue.message}</h1>
        <div className="flex flex-wrap gap-2">
          {issue.status === 'open' ? (
            <>
              {action('resolved', t('errors.markResolved'), CheckCircle2, 'default')}
              {action('ignored', t('errors.markIgnored'), EyeOff)}
            </>
          ) : (
            action('open', t('errors.reopen'), RotateCcw)
          )}
        </div>
        {update.error ? (
          <p role="alert" className="text-sm text-destructive">
            {getErrorMessage(update.error, t('ui.loadFailed'))}
          </p>
        ) : null}
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label={t('errors.count')} value={f.number(issue.count)} />
        <StatTile label={t('errors.users')} value={f.number(issue.users)} />
        <StatTile label={t('errors.firstSeen')} value={f.relative(issue.firstSeen)} />
        <StatTile label={t('errors.lastSeen')} value={f.relative(issue.lastSeen)} />
      </div>
      <TrendCard
        title={t('errors.trend')}
        data={issue.trend}
        series={[{ key: 'count', label: t('errors.count'), color: 'series-2' }]}
        bucket={bucketOfRange[params.range]}
        isFetching={query.isFetching}
        height={160}
      />
      <div className="grid gap-4 md:grid-cols-2">
        <Distribution title={t('errors.browsers')} rows={issue.browsers} />
        <Distribution title={t('errors.systems')} rows={issue.systems} />
      </div>
      <OccurrencePanel issueId={issue.id} />
    </div>
  );
}
