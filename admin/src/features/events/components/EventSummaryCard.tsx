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
import { cn } from '@/core/utils/cn';
import { useFormat } from '@/hooks/useFormat';
import type { RangeParams } from '@/types/monitor';
import { useEventSummary } from '../hooks/useEvents';

interface EventSummaryCardProps {
  params: RangeParams;
  selected?: string;
  onSelect(name: string | undefined): void;
}

/** 埋点事件汇总：次数、人数、人均、最近触发。点击事件名筛选下方明细。 */
export function EventSummaryCard({ params, selected, onSelect }: EventSummaryCardProps) {
  const { t } = useTranslation();
  const f = useFormat();
  const query = useEventSummary(params);
  const rows = query.data;
  const max = Math.max(1, ...(rows ?? []).map((r) => r.count));

  return (
    <Card>
      <CardHeader title={t('events.summary')} />
      <CardContent className="p-0">
        {!rows ? (
          <StateMessage kind={query.isError ? 'error' : 'loading'}>
            {query.isError ? t('ui.loadFailed') : t('common.loading')}
          </StateMessage>
        ) : rows.length === 0 ? (
          <StateMessage kind="empty">{t('events.empty')}</StateMessage>
        ) : (
          <Table className={cn('transition-opacity', query.isFetching && 'opacity-60')}>
            <TableHeader>
              <TableRow>
                <TableHead>{t('events.name')}</TableHead>
                <TableHead className="w-2/5">{t('events.count')}</TableHead>
                <TableHead className="text-right">{t('events.visitors')}</TableHead>
                <TableHead className="text-right">{t('events.lastSeen')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow
                  key={r.name}
                  data-state={selected === r.name ? 'selected' : undefined}
                  className="data-[state=selected]:bg-accent"
                >
                  <TableCell>
                    <button
                      type="button"
                      className="font-mono text-xs font-medium hover:underline"
                      aria-pressed={selected === r.name}
                      onClick={() => onSelect(selected === r.name ? undefined : r.name)}
                    >
                      {r.name}
                    </button>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-2 flex-1">
                        <div
                          className="h-2 rounded-r-[4px] bg-series-1"
                          style={{ width: `${Math.max(1, (r.count / max) * 100)}%` }}
                        />
                      </div>
                      <span className="w-14 text-right tabular-nums">{f.number(r.count)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{f.number(r.visitors)}</TableCell>
                  <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                    {f.relative(r.lastSeen)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
