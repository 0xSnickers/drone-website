import { Database, Layers, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/core/utils/cn';
import { useFormat } from '@/hooks/useFormat';
import { useSystemStatus } from '../hooks/useSystemStatus';

export function SystemStatusCard() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, isFetching, isError } = useSystemStatus();

  if (isError && !data) return null;
  if (!data) return null;

  const isDegraded = data.effectiveMode === 'degraded_fallback' || !data.database.ok;
  const isHaQueue = data.effectiveMode === 'redis_queue';
  const totalBacklog = data.redis.eventsQueueDepth + data.redis.logsQueueDepth;

  const modeBadge = isDegraded ? (
    <Badge variant="warning">
      <ShieldAlert />
      {t('system.modeDegraded', { seconds: data.redis.circuitRemainingSec })}
    </Badge>
  ) : isHaQueue ? (
    <Badge variant="success">
      <ShieldCheck />
      {t('system.modeQueue')}
    </Badge>
  ) : (
    <Badge variant="success">
      <ShieldCheck />
      {t('system.modeDirect')}
    </Badge>
  );

  const channelLabel =
    data.effectiveMode === 'degraded_fallback'
      ? t('system.channelDegraded', {
          rate: Math.round(data.protection.fallbackSampleRate * 100),
        })
      : isHaQueue
        ? t('system.channelQueue')
        : t('system.channelDirect');

  return (
    <Card className={cn('transition-opacity', isFetching && 'opacity-75')}>
      <CardHeader title={t('system.title')} actions={modeBadge} />
      <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-md border p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('system.dbStatus')}</span>
            <Database className="size-3.5" aria-hidden />
          </div>
          <p
            className={cn(
              'mt-1 text-sm font-medium tabular-nums',
              !data.database.ok && 'text-critical',
            )}
          >
            {data.database.ok
              ? t('system.dbHealthy', {
                  engine: data.database.engine,
                  ms: data.database.latencyMs,
                })
              : t('system.dbUnhealthy', { engine: data.database.engine })}
          </p>
        </div>

        <div className="rounded-md border p-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('system.channel')}</span>
            <Layers className="size-3.5" aria-hidden />
          </div>
          <p className={cn('mt-1 text-sm font-medium', isDegraded && 'text-warning')}>
            {channelLabel}
          </p>
        </div>

        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{t('system.queueDepth')}</div>
          <p
            className={cn(
              'mt-1 text-sm font-medium tabular-nums',
              totalBacklog > 1000 && 'text-warning',
            )}
          >
            {data.redis.configured
              ? t('system.queueCounts', {
                  events: f.number(data.redis.eventsQueueDepth),
                  logs: f.number(data.redis.logsQueueDepth),
                })
              : t('system.queueDisabled')}
          </p>
        </div>

        <div className="rounded-md border p-3">
          <div className="text-xs text-muted-foreground">{t('system.protection')}</div>
          <p className="mt-1 text-sm font-medium tabular-nums">
            {t('system.protectionSummary', {
              limit: f.number(data.protection.ingestRateLimit),
              ips: f.number(data.protection.localTrackedIps),
              selfLog: data.protection.selfLogEnabled ? t('system.on') : t('system.off'),
            })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
