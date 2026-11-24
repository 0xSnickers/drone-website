import { Fragment, useState } from 'react';
import { ChevronRight, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
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
import { statusTone } from '@/lib/http-status';
import type { RangeParams } from '@/types/monitor';
import { useLogs } from '../hooks/useLogs';
import { LOG_LEVELS, STATUS_CLASSES, type LogFilters, type ServerLog } from '../types';
import { LevelBadge } from './LevelBadge';

function LogDetail({ log, onFilter }: { log: ServerLog; onFilter(patch: LogFilters): void }) {
  const { t } = useTranslation();
  const meta = Object.keys(log.meta ?? {}).length ? log.meta : null;
  const stack = typeof meta?.stack === 'string' ? meta.stack : null;
  return (
    <div className="space-y-3 bg-muted/40 px-3 py-3 text-xs">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1">
        <dt className="text-muted-foreground">{t('logs.message')}</dt>
        <dd className="break-all">{log.message}</dd>
        {log.requestId ? (
          <>
            <dt className="text-muted-foreground">{t('logs.requestId')}</dt>
            <dd>
              <button
                type="button"
                className="font-mono hover:underline"
                onClick={() => onFilter({ requestId: log.requestId ?? undefined })}
              >
                {log.requestId}
              </button>
            </dd>
          </>
        ) : null}
        {log.userAgent ? (
          <>
            <dt className="text-muted-foreground">User-Agent</dt>
            <dd className="break-all">{log.userAgent}</dd>
          </>
        ) : null}
      </dl>
      {stack ? (
        <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 font-mono">{stack}</pre>
      ) : null}
      {meta && !stack ? (
        <pre className="overflow-auto rounded-md bg-muted p-3 font-mono">
          {JSON.stringify(meta, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}

/** 日志明细：服务 / 级别 / 状态码 / 关键字筛选，点击行展开详情，点击请求 ID 查看同一请求的所有日志。 */
export function LogTable({
  params,
  service,
  onServiceChange,
  services,
}: {
  params: RangeParams;
  service?: string;
  onServiceChange(service: string | undefined): void;
  services: string[];
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const [filters, setFilters] = useState<LogFilters>({ page: 1 });
  const [q, setQ] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const query = useLogs({ ...params, ...filters, service, limit: 30 });
  const set = (patch: LogFilters) =>
    setFilters((cur) => ({ ...cur, ...patch, page: patch.page ?? 1 }));
  const data = query.data;

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: q.trim() || undefined });
        }}
      >
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('logs.searchPlaceholder')}
            aria-label={t('ui.search')}
          />
        </div>
        <Select
          aria-label={t('logs.service')}
          value={service ?? ''}
          onChange={(e) => onServiceChange(e.target.value || undefined)}
        >
          <option value="">{t('logs.allServices')}</option>
          {services.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('logs.level')}
          value={filters.level ?? ''}
          onChange={(e) => set({ level: (e.target.value || undefined) as LogFilters['level'] })}
        >
          <option value="">{`${t('logs.level')}: ${t('ui.all')}`}</option>
          {LOG_LEVELS.map((l) => (
            <option key={l} value={l}>
              {t(`logs.levels.${l}`)}
            </option>
          ))}
        </Select>
        <Select
          aria-label={t('logs.statusClass')}
          value={filters.statusClass ?? ''}
          onChange={(e) =>
            set({ statusClass: (e.target.value || undefined) as LogFilters['statusClass'] })
          }
        >
          <option value="">{`${t('logs.statusClass')}: ${t('ui.all')}`}</option>
          {STATUS_CLASSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        {filters.requestId ? (
          <button
            type="button"
            className="rounded-md border px-2 py-1 font-mono text-xs hover:bg-accent"
            onClick={() => set({ requestId: undefined })}
          >
            {filters.requestId} ×
          </button>
        ) : null}
      </form>
      <Card>
        <CardContent className="p-0">
          {!data ? (
            <StateMessage kind={query.isError ? 'error' : 'loading'}>
              {query.isError ? t('ui.loadFailed') : t('common.loading')}
            </StateMessage>
          ) : data.items.length === 0 ? (
            <StateMessage kind="empty">{t('common.empty')}</StateMessage>
          ) : (
            <Table className={cn('transition-opacity', query.isFetching && 'opacity-60')}>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-6" />
                  <TableHead>{t('ui.time')}</TableHead>
                  <TableHead>{t('logs.level')}</TableHead>
                  <TableHead>{t('logs.service')}</TableHead>
                  <TableHead>{t('logs.message')}</TableHead>
                  <TableHead className="text-right">{t('logs.duration')}</TableHead>
                  <TableHead>{t('logs.ip')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((log) => (
                  <Fragment key={log.id}>
                    <TableRow
                      className="cursor-pointer"
                      onClick={() => setOpen(open === log.id ? null : log.id)}
                      aria-expanded={open === log.id}
                    >
                      <TableCell className="pr-0">
                        <ChevronRight
                          className={cn(
                            'size-4 text-muted-foreground transition-transform',
                            open === log.id && 'rotate-90',
                          )}
                          aria-hidden
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                        {f.dateTime(log.createdAt)}
                      </TableCell>
                      <TableCell>
                        <LevelBadge level={log.level} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{log.service}</TableCell>
                      <TableCell className="max-w-[26rem] truncate font-mono text-xs">
                        {log.status !== null ? (
                          <>
                            <span className="text-muted-foreground">{log.method}</span>{' '}
                            {log.path?.split('?')[0]}{' '}
                            <span className={cn('font-semibold', statusTone(log.status))}>
                              {log.status}
                            </span>
                          </>
                        ) : (
                          log.message
                        )}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap tabular-nums">
                        {log.durationMs !== null ? f.ms(log.durationMs) : '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {log.ip ? (
                          <Link
                            to={`/ips/${encodeURIComponent(log.ip)}`}
                            onClick={(e) => e.stopPropagation()}
                            className="font-mono text-xs hover:underline"
                          >
                            {log.ip}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                    </TableRow>
                    {open === log.id ? (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={7} className="p-0">
                          <LogDetail log={log} onFilter={set} />
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {data ? (
        <Pagination
          page={data.pagination.page}
          totalPages={data.pagination.totalPages}
          onChange={(page) => set({ page })}
          labels={{
            prev: t('ui.prev'),
            next: t('ui.next'),
            summary: t('ui.total', { total: data.pagination.total }),
          }}
        />
      ) : null}
    </div>
  );
}
