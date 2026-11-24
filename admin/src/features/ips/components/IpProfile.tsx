import { Ban, Undo2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { StatTile } from '@/components/charts/stat-tile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StateMessage } from '@/components/ui/state';
import { cn } from '@/core/utils/cn';
import { useFormat } from '@/hooks/useFormat';
import { statusTone } from '@/lib/http-status';
import { bucketOfRange, type Named, type RangeParams } from '@/types/monitor';
import { RankCard, TrendCard } from '@/features/analytics';
import { useIpDetail, useIpRuleMutations, useIpRules } from '../hooks/useIps';

/** 单个 IP 的画像。 */
export function IpProfile({
  ip,
  params,
  canEdit,
}: {
  ip: string;
  params: RangeParams;
  canEdit: boolean;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const query = useIpDetail(ip, params);
  const rules = useIpRules();
  const { block, unblock } = useIpRuleMutations();
  const rule = rules.data?.find((r) => r.ip === ip);
  const data = query.data;
  const s = data?.summary;
  const named = (rows: Named[] | undefined, mono = false) =>
    rows?.map((r) => ({
      key: r.name,
      label: <span className={cn(mono && 'font-mono text-xs')}>{r.name}</span>,
      value: r.count,
      display: f.number(r.count),
    }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-mono text-xl font-semibold">{ip}</h1>
        {rule ? (
          <Badge variant="critical">
            <Ban aria-hidden />
            {t('ips.blocked')}
          </Badge>
        ) : null}
        <div className="ml-auto">
          {rule ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!canEdit || unblock.isPending}
              onClick={() => unblock.mutate(rule.id)}
            >
              <Undo2 />
              {t('ips.unblock')}
            </Button>
          ) : (
            <Button
              variant="destructive"
              size="sm"
              disabled={!canEdit || block.isPending}
              title={canEdit ? undefined : t('ui.adminOnly')}
              onClick={() => block.mutate({ ip })}
            >
              <Ban />
              {t('ips.block')}
            </Button>
          )}
        </div>
      </div>
      {!data ? (
        <StateMessage kind={query.isError ? 'error' : 'loading'}>
          {query.isError ? t('ui.loadFailed') : t('common.loading')}
        </StateMessage>
      ) : !s ? (
        <StateMessage kind="empty">{t('ips.noData')}</StateMessage>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <StatTile label={t('ips.total')} value={f.number(s.total)} />
            <StatTile label={t('ips.visitors')} value={f.number(s.visitors)} />
            <StatTile label={t('ips.errors')} value={f.number(s.errors)} />
            <StatTile label={t('ips.lastSeen')} value={f.relative(s.lastSeen)} />
          </div>
          <TrendCard
            title={t('ips.trend')}
            data={data.trend}
            series={[{ key: 'count', label: t('ips.total'), color: 'series-1' }]}
            bucket={bucketOfRange[params.range]}
            isFetching={query.isFetching}
            height={160}
          />
          <div className="grid gap-4 lg:grid-cols-3">
            <RankCard title={t('ips.pages')} items={named(data.pages, true)} />
            <RankCard title={t('ips.agents')} items={named(data.agents)} />
            <RankCard title={t('ips.visitorIds')} items={named(data.visitors, true)} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader title={t('ips.recentErrors')} />
              <CardContent>
                {data.errors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.errors.map((e) => (
                      <li key={e.id} className="min-w-0">
                        <Link
                          to={`/errors/${e.issueId}`}
                          className="block truncate hover:underline"
                        >
                          {e.message}
                        </Link>
                        <span className="text-xs text-muted-foreground">
                          {e.path} · {f.relative(e.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title={t('ips.recentRequests')} />
              <CardContent>
                {data.requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t('common.empty')}</p>
                ) : (
                  <ul className="space-y-1.5 font-mono text-xs">
                    {data.requests.map((r) => (
                      <li key={r.id} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate">
                          <span className="text-muted-foreground">{r.method}</span> {r.path}{' '}
                          <span className={statusTone(r.status)}>{r.status}</span>
                        </span>
                        <span className="shrink-0 text-muted-foreground">
                          {f.relative(r.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
