import { useState } from 'react';
import { Eye, Gauge, Plus, Rocket, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
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
import { useReleaseMutations, useReleases, useStressRuns } from '../hooks/useOps';
import type { ReleaseStatus } from '../types';
import { ReleaseDialog } from './ReleaseDialog';
import { StressRunDetailDialog } from './StressRunDetailDialog';

function releaseBadgeVariant(
  status: ReleaseStatus,
): 'success' | 'critical' | 'warning' | 'default' {
  if (status === 'success') return 'success';
  if (status === 'failed') return 'critical';
  if (status === 'running' || status === 'rolled_back') return 'warning';
  return 'default';
}

export function OpsCenterPanel({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [tab, setTab] = useState<'releases' | 'stress'>('releases');
  const [relPage, setRelPage] = useState(1);
  const [stressPage, setStressPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  const releases = useReleases(relPage, 10);
  const stressRuns = useStressRuns(stressPage, 10);
  const { create, remove } = useReleaseMutations();

  const latestRelease = releases.data?.items[0];
  const latestStress = stressRuns.data?.items[0];

  return (
    <div className="space-y-6">
      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">{t('ops.kpi.latestRelease')}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="font-mono text-xl font-semibold">
                {latestRelease?.version ?? '—'}
              </span>
              {latestRelease ? (
                <Badge variant={releaseBadgeVariant(latestRelease.status)}>
                  {t(`ops.releases.statuses.${latestRelease.status}`)}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {latestRelease
                ? `${latestRelease.environment} · ${f.dateTime(latestRelease.deployedAt)}`
                : t('ops.releases.empty')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">{t('ops.kpi.totalReleases')}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {releases.data?.pagination.total ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('ops.kpi.releaseHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">{t('ops.kpi.latestStress')}</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xl font-semibold tabular-nums">
                {latestStress
                  ? `${latestStress.passedScenarios}/${latestStress.totalScenarios}`
                  : '—'}
              </span>
              {latestStress ? (
                <Badge variant={latestStress.passed ? 'success' : 'critical'}>
                  {latestStress.passed ? t('ops.stress.passed') : t('ops.stress.failed')}
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {latestStress
                ? `${latestStress.overallRps} req/s · Err ${(latestStress.errorRate * 100).toFixed(2)}%`
                : t('ops.stress.empty')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground">{t('ops.kpi.totalStressRuns')}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {stressRuns.data?.pagination.total ?? 0}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{t('ops.kpi.stressHint')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tab Switcher + Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-md border bg-muted/40 p-1">
          <Button
            type="button"
            variant={tab === 'releases' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('releases')}
          >
            <Rocket />
            {t('ops.tabs.releases')}
          </Button>
          <Button
            type="button"
            variant={tab === 'stress' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setTab('stress')}
          >
            <Gauge />
            {t('ops.tabs.stress')}
          </Button>
        </div>

        {tab === 'releases' ? (
          <Button
            disabled={!canEdit}
            title={canEdit ? undefined : t('ui.adminOnly')}
            onClick={() => {
              create.reset();
              setCreateOpen(true);
            }}
          >
            <Plus />
            {t('ops.releases.create')}
          </Button>
        ) : null}
      </div>

      {/* Tab 1: Releases */}
      {tab === 'releases' ? (
        !releases.data ? (
          <StateMessage kind={releases.isError ? 'error' : 'loading'}>
            {releases.isError ? t('ui.loadFailed') : t('common.loading')}
          </StateMessage>
        ) : releases.data.items.length === 0 ? (
          <StateMessage kind="empty">{t('ops.releases.empty')}</StateMessage>
        ) : (
          <Card className={releases.isPlaceholderData ? 'opacity-60' : undefined}>
            <CardContent className="space-y-4 pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ops.releases.version')}</TableHead>
                    <TableHead>{t('ops.releases.environment')}</TableHead>
                    <TableHead>{t('ops.releases.status')}</TableHead>
                    <TableHead>{t('ops.releases.commit')}</TableHead>
                    <TableHead>{t('ops.releases.notes')}</TableHead>
                    <TableHead>{t('ops.releases.deployedAt')}</TableHead>
                    {canEdit ? <TableHead className="text-right">{t('ui.actions')}</TableHead> : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {releases.data.items.map((rel) => (
                    <TableRow key={rel.id}>
                      <TableCell className="font-mono font-semibold">{rel.version}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{rel.environment}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={releaseBadgeVariant(rel.status)}>
                          {t(`ops.releases.statuses.${rel.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {rel.branch}
                        {rel.commitSha ? ` @ ${rel.commitSha.slice(0, 8)}` : ''}
                      </TableCell>
                      <TableCell className="max-w-[280px] truncate text-xs text-muted-foreground">
                        {rel.notes || '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {f.dateTime(rel.deployedAt)}
                      </TableCell>
                      {canEdit ? (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={remove.isPending}
                            onClick={() => remove.mutate(rel.id)}
                          >
                            <Trash2 />
                          </Button>
                        </TableCell>
                      ) : null}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={releases.data.pagination.page}
                totalPages={releases.data.pagination.totalPages}
                onChange={setRelPage}
                labels={{
                  prev: t('ui.prev'),
                  next: t('ui.next'),
                  summary: t('ui.total', { total: releases.data.pagination.total }),
                }}
              />
            </CardContent>
          </Card>
        )
      ) : null}

      {/* Tab 2: Stress Runs */}
      {tab === 'stress' ? (
        !stressRuns.data ? (
          <StateMessage kind={stressRuns.isError ? 'error' : 'loading'}>
            {stressRuns.isError ? t('ui.loadFailed') : t('common.loading')}
          </StateMessage>
        ) : stressRuns.data.items.length === 0 ? (
          <StateMessage kind="empty">{t('ops.stress.empty')}</StateMessage>
        ) : (
          <Card className={stressRuns.isPlaceholderData ? 'opacity-60' : undefined}>
            <CardContent className="space-y-4 pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('ops.stress.runId')}</TableHead>
                    <TableHead>{t('ops.stress.profile')}</TableHead>
                    <TableHead>{t('ops.stress.scenarios')}</TableHead>
                    <TableHead className="text-right">{t('ops.stress.rps')}</TableHead>
                    <TableHead className="text-right">{t('ops.stress.errorRate')}</TableHead>
                    <TableHead>{t('ops.stress.result')}</TableHead>
                    <TableHead>{t('ui.time')}</TableHead>
                    <TableHead className="text-right">{t('ui.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stressRuns.data.items.map((run) => (
                    <TableRow key={run.runId}>
                      <TableCell className="font-mono text-xs font-medium">{run.runId}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline">{run.profile}</Badge>{' '}
                        <span className="text-muted-foreground">{run.suite}</span>
                      </TableCell>
                      <TableCell className="font-mono text-xs tabular-nums">
                        {run.passedScenarios} / {run.totalScenarios}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {run.overallRps} req/s
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs tabular-nums">
                        {(run.errorRate * 100).toFixed(2)}%
                      </TableCell>
                      <TableCell>
                        <Badge variant={run.passed ? 'success' : 'critical'}>
                          {run.passed ? t('ops.stress.passed') : t('ops.stress.failed')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {f.dateTime(run.startedAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedRunId(run.runId)}
                        >
                          <Eye />
                          {t('ui.view')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pagination
                page={stressRuns.data.pagination.page}
                totalPages={stressRuns.data.pagination.totalPages}
                onChange={setStressPage}
                labels={{
                  prev: t('ui.prev'),
                  next: t('ui.next'),
                  summary: t('ui.total', { total: stressRuns.data.pagination.total }),
                }}
              />
            </CardContent>
          </Card>
        )
      ) : null}

      {createOpen ? (
        <ReleaseDialog
          open
          onOpenChange={setCreateOpen}
          pending={create.isPending}
          error={create.error}
          onSubmit={(input) => create.mutate(input, { onSuccess: () => setCreateOpen(false) })}
        />
      ) : null}

      <StressRunDetailDialog runId={selectedRunId} onClose={() => setSelectedRunId(null)} />
    </div>
  );
}
