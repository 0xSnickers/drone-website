import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { useStressRunDetail } from '../hooks/useOps';

interface StressRunDetailDialogProps {
  runId: string | null;
  onClose(): void;
}

export function StressRunDetailDialog({ runId, onClose }: StressRunDetailDialogProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const detail = useStressRunDetail(runId);
  const data = detail.data;

  return (
    <Dialog open={Boolean(runId)} onOpenChange={(open) => (!open ? onClose() : undefined)}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 font-mono text-base">
            <span>{runId}</span>
            {data ? (
              <Badge variant={data.passed ? 'success' : 'critical'}>
                {data.passed ? t('ops.stress.passed') : t('ops.stress.failed')}
              </Badge>
            ) : null}
          </DialogTitle>
          {data ? (
            <DialogDescription>
              {data.profileLabel} · {data.suite} · {f.dateTime(data.startedAt)} ·{' '}
              {data.durationSec}s
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {!data ? (
          <StateMessage kind={detail.isError ? 'error' : 'loading'}>
            {detail.isError ? t('ui.loadFailed') : t('common.loading')}
          </StateMessage>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t('ops.stress.scenarios')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {data.passedScenarios} / {data.totalScenarios}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t('ops.stress.totalRequests')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {data.totalRequests.toLocaleString()}
                </p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t('ops.stress.rps')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">{data.overallRps} req/s</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">{t('ops.stress.errorRate')}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {(data.errorRate * 100).toFixed(2)}%
                </p>
              </div>
            </div>

            {data.httpScenarios.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t('ops.stress.httpScenarios')}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('ops.stress.scenario')}</TableHead>
                      <TableHead className="text-right">RPS</TableHead>
                      <TableHead className="text-right">2xx / 429 / Err</TableHead>
                      <TableHead className="text-right">P50 / P95 / P99</TableHead>
                      <TableHead className="text-right">SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.httpScenarios.map((s) => (
                      <TableRow key={s.id || s.name}>
                        <TableCell className="max-w-[240px] truncate text-xs font-medium">
                          {s.name}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {s.successRps} / {s.rps}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {s.successRequests} / {s.rateLimitedRequests} / {s.failedRequests}
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {s.p50} / {s.p95} / {s.p99}ms
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={s.passed ? 'success' : 'critical'}>
                            {s.passed ? 'PASS' : 'FAIL'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {data.browserScenarios.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t('ops.stress.browserScenarios')}</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('ops.stress.scenario')}</TableHead>
                      <TableHead className="text-right">FCP P95</TableHead>
                      <TableHead className="text-right">Load P95</TableHead>
                      <TableHead className="text-right">JS Err</TableHead>
                      <TableHead className="text-right">SLA</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.browserScenarios.map((b) => (
                      <TableRow key={b.id || b.name}>
                        <TableCell className="text-xs font-medium">{b.name}</TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {b.fcpP95}ms
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {b.loadP95}ms
                        </TableCell>
                        <TableCell className="text-right font-mono text-xs tabular-nums">
                          {b.jsErrors}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={b.passed ? 'success' : 'critical'}>
                            {b.passed ? 'PASS' : 'FAIL'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : null}

            {data.recommendations.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold">{t('ops.stress.recommendations')}</h3>
                <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {data.recommendations.map((rec, idx) => (
                    <li key={idx}>{rec}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
