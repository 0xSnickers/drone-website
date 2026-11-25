import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Flame,
  Gauge,
  HardDrive,
  Timer,
  Users,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/core/utils/cn';
import { useFormat } from '@/hooks/useFormat';
import { useSystemStatus } from '../hooks/useSystemStatus';
import type { BottleneckLevel } from '../types';

function barColorByPct(pct: number): string {
  if (pct >= 85) return 'bg-critical';
  if (pct >= 70) return 'bg-warning';
  return 'bg-series-1';
}

function MeterBar({ percent, toneClass }: { percent: number; toneClass: string }) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div
      className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className={cn('h-full rounded-full transition-all duration-300', toneClass)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export function StressBottleneckCard() {
  const { t } = useTranslation();
  const f = useFormat();
  const { data, isFetching } = useSystemStatus();

  if (!data?.host || !data.traffic || !data.bottleneck || !data.stressTest) {
    return null;
  }

  const { host, traffic, bottleneck, stressTest, onlineCapacity } = data;
  const level: BottleneckLevel = bottleneck.level;
  const online = onlineCapacity ?? {
    onlineUsers: 0,
    activeSessions: 0,
    estimatedMaxOnline: Math.max(50, Math.round(bottleneck.safeRpsBaseline * 8)),
    usagePercent: 0,
    riskLevel: level === 'critical' ? 'high' : level === 'approaching' ? 'busy' : 'safe',
    windowMinutes: 5,
  };
  const onlineTone =
    online.riskLevel === 'high'
      ? 'bg-critical'
      : online.riskLevel === 'busy'
        ? 'bg-warning'
        : 'bg-series-1';

  const stressBadge = stressTest.active ? (
    <Badge variant="primary">
      <Flame className="animate-pulse" />
      {stressTest.profile
        ? t('system.radar.stressRunning', {
            profile: stressTest.profile,
            vus: stressTest.concurrency,
          })
        : t('system.radar.stressPulse')}
    </Badge>
  ) : (
    <Badge variant="outline">
      <Activity />
      {stressTest.lastReport
        ? t('system.radar.lastRun', {
            profile: stressTest.lastReport.profile,
            rps: stressTest.lastReport.overallRps,
          })
        : t('system.radar.stressIdle')}
    </Badge>
  );

  const verdictBadge =
    level === 'critical' ? (
      <Badge variant="critical">
        <AlertTriangle />
        {t('system.radar.levelCritical')}
      </Badge>
    ) : level === 'approaching' ? (
      <Badge variant="warning">
        <AlertTriangle />
        {t('system.radar.levelApproaching', { headroom: bottleneck.headroomPercent })}
      </Badge>
    ) : (
      <Badge variant="success">
        <CheckCircle2 />
        {t('system.radar.levelHealthy', { headroom: bottleneck.headroomPercent })}
      </Badge>
    );

  const cpuSaturation = Math.max(host.cpuPercent, Math.min(100, host.loadRatio * 100));
  const latencySaturation = Math.min(100, (traffic.p95LatencyMs / 1000) * 100);
  const latencyTone =
    traffic.error5xx1m > 0 || traffic.p95LatencyMs >= 1000
      ? 'bg-critical'
      : traffic.p95LatencyMs >= 400
        ? 'bg-warning'
        : 'bg-series-1';

  const factorMessage = t(`system.radar.factors.${bottleneck.primaryFactor}`);

  return (
    <Card className={cn('transition-opacity', isFetching && 'opacity-85')}>
      <CardHeader
        title={t('system.radar.title')}
        description={
          stressTest.active && stressTest.currentScenario
            ? t('system.radar.scenarioRunning', { scenario: stressTest.currentScenario })
            : factorMessage
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {stressBadge}
            {verdictBadge}
          </div>
        }
      />
      <CardContent className="space-y-3">
        <div className="rounded-md border bg-muted/30 p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Users className="size-4 text-primary" aria-hidden />
              <span>{t('system.radar.onlineTitle')}</span>
              <Badge
                variant={
                  online.riskLevel === 'high'
                    ? 'critical'
                    : online.riskLevel === 'busy'
                      ? 'warning'
                      : 'success'
                }
              >
                {t(`system.radar.onlineRisk.${online.riskLevel}`)}
              </Badge>
            </div>
            <p className="text-sm font-semibold tabular-nums">
              {t('system.radar.onlineCount', {
                current: f.number(online.onlineUsers),
                max: f.number(online.estimatedMaxOnline),
              })}
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({online.usagePercent}%)
              </span>
            </p>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {t('system.radar.onlineHint', {
              minutes: online.windowMinutes,
              sessions: f.number(online.activeSessions),
            })}
          </p>
          <MeterBar percent={online.usagePercent} toneClass={onlineTone} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('system.radar.cpuGauge')}</span>
              <Cpu className="size-3.5" aria-hidden />
            </div>
            <p className="mt-1 text-base font-semibold tabular-nums">{host.cpuPercent}%</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('system.radar.cpuDetail', { load: host.loadAvg1m, cores: host.cpuCores })}
            </p>
            <MeterBar percent={cpuSaturation} toneClass={barColorByPct(cpuSaturation)} />
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('system.radar.memGauge')}</span>
              <HardDrive className="size-3.5" aria-hidden />
            </div>
            <p className="mt-1 text-base font-semibold tabular-nums">{host.memPercent}%</p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('system.radar.memDetail', { used: host.memUsedGb, total: host.memTotalGb })}
            </p>
            <MeterBar percent={host.memPercent} toneClass={barColorByPct(host.memPercent)} />
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('system.radar.tpsGauge')}</span>
              <Gauge className="size-3.5" aria-hidden />
            </div>
            <p className="mt-1 text-base font-semibold tabular-nums">
              {traffic.currentRps} req/s{' '}
              <span className="text-xs font-normal text-muted-foreground">
                ({bottleneck.capacityPercent}%)
              </span>
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('system.radar.tpsDetail', { baseline: bottleneck.safeRpsBaseline })}
            </p>
            <MeterBar
              percent={bottleneck.capacityPercent}
              toneClass={barColorByPct(bottleneck.capacityPercent)}
            />
          </div>

          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{t('system.radar.latencyGauge')}</span>
              <Timer className="size-3.5" aria-hidden />
            </div>
            <p
              className={cn(
                'mt-1 text-base font-semibold tabular-nums',
                traffic.error5xx1m > 0 && 'text-critical',
              )}
            >
              {traffic.p95LatencyMs} ms
            </p>
            <p className="text-xs text-muted-foreground tabular-nums">
              {t('system.radar.latencyDetail', {
                err5xx: f.number(traffic.error5xx1m),
                rl429: f.number(traffic.rateLimited4291m),
              })}
            </p>
            <MeterBar percent={latencySaturation} toneClass={latencyTone} />
          </div>
        </div>

        {level !== 'healthy' ? (
          <div
            role="status"
            className={cn(
              'flex items-center gap-2 rounded-md border px-3 py-2 text-xs',
              level === 'critical'
                ? 'border-critical/30 bg-critical/10 text-critical'
                : 'border-warning/30 bg-warning/10 text-warning',
            )}
          >
            <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
            <span>{factorMessage}</span>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
