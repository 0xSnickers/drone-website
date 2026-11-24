import { useState } from 'react';
import { Search } from 'lucide-react';
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
import type { RangeParams } from '@/types/monitor';
import { useIssues } from '../hooks/useIssues';
import { ERROR_TYPES, ISSUE_STATUSES, type IssueFilters } from '../types';
import { ErrorTypeBadge, IssueStatusBadge } from './IssueBadges';

/** 异常列表：状态 / 类型 / 排序 / 关键字筛选 + 分页。compact 用于概览页（只显示前几条）。 */
export function IssueList({ params, compact = false }: { params: RangeParams; compact?: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [filters, setFilters] = useState<IssueFilters>({
    status: compact ? 'open' : undefined,
    sort: 'frequent',
    page: 1,
  });
  const [q, setQ] = useState('');
  const query = useIssues({ ...params, ...filters, limit: compact ? 5 : 20 });
  const set = (patch: IssueFilters) =>
    setFilters((cur) => ({ ...cur, ...patch, page: patch.page ?? 1 }));
  const data = query.data;

  return (
    <div className="space-y-3">
      {!compact ? (
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
              placeholder={t('errors.searchPlaceholder')}
              aria-label={t('ui.search')}
            />
          </div>
          <Select
            aria-label={t('errors.status')}
            value={filters.status ?? ''}
            onChange={(e) =>
              set({ status: (e.target.value || undefined) as IssueFilters['status'] })
            }
          >
            <option value="">{`${t('errors.status')}: ${t('ui.all')}`}</option>
            {ISSUE_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`errors.statuses.${s}`)}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('errors.type')}
            value={filters.type ?? ''}
            onChange={(e) => set({ type: (e.target.value || undefined) as IssueFilters['type'] })}
          >
            <option value="">{`${t('errors.type')}: ${t('ui.all')}`}</option>
            {ERROR_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`errors.types.${type}`)}
              </option>
            ))}
          </Select>
          <Select
            aria-label={t('errors.sort')}
            value={filters.sort}
            onChange={(e) => set({ sort: e.target.value as IssueFilters['sort'] })}
          >
            <option value="frequent">{t('errors.sortFrequent')}</option>
            <option value="recent">{t('errors.sortRecent')}</option>
          </Select>
        </form>
      ) : null}

      <Card>
        <CardContent className="p-0">
          {!data ? (
            <StateMessage kind={query.isError ? 'error' : 'loading'}>
              {query.isError ? t('ui.loadFailed') : t('common.loading')}
            </StateMessage>
          ) : data.items.length === 0 ? (
            <StateMessage kind="empty">{t('errors.empty')}</StateMessage>
          ) : (
            <Table className={cn('transition-opacity', query.isFetching && 'opacity-60')}>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('errors.message')}</TableHead>
                  {!compact ? <TableHead>{t('errors.status')}</TableHead> : null}
                  <TableHead className="text-right">{t('errors.rangeCount')}</TableHead>
                  <TableHead className="text-right">{t('errors.users')}</TableHead>
                  <TableHead className="text-right">{t('errors.lastSeen')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((issue) => (
                  <TableRow key={issue.id}>
                    <TableCell className="max-w-[28rem]">
                      <Link
                        to={`/errors/${issue.id}`}
                        className="block truncate font-medium hover:underline"
                        title={issue.message}
                      >
                        {issue.message}
                      </Link>
                      <div className="mt-1 flex items-center gap-2">
                        <ErrorTypeBadge type={issue.type} />
                        <span className="text-xs text-muted-foreground">
                          {t('errors.count')} {f.number(issue.count)} · {t('errors.firstSeen')}{' '}
                          {f.relative(issue.firstSeen)}
                        </span>
                      </div>
                    </TableCell>
                    {!compact ? (
                      <TableCell>
                        <IssueStatusBadge status={issue.status} />
                      </TableCell>
                    ) : null}
                    <TableCell className="text-right tabular-nums">
                      {f.number(issue.rangeCount ?? issue.count)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.number(issue.users ?? 0)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                      {f.relative(issue.lastSeen)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      {data && !compact ? (
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
