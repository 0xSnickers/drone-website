import { useState } from 'react';
import { Ban, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { cn } from '@/core/utils/cn';
import { useFormat } from '@/hooks/useFormat';
import type { RangeParams } from '@/types/monitor';
import { useIpRuleMutations, useIps } from '../hooks/useIps';

/** IP 汇总表：按总请求量排序，可前缀搜索，管理员可一键拉黑。 */
export function IpTable({ params, canEdit }: { params: RangeParams; canEdit: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const query = useIps({ ...params, q: search, page, limit: 20 });
  const { block } = useIpRuleMutations();
  const data = query.data;
  const max = Math.max(1, ...(data?.items ?? []).map((i) => i.total));

  return (
    <div className="space-y-3">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(q.trim() || undefined);
          setPage(1);
        }}
      >
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-8"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t('ips.searchPlaceholder')}
            aria-label={t('ui.search')}
          />
        </div>
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
                  <TableHead>{t('ips.ip')}</TableHead>
                  <TableHead className="w-1/4">{t('ips.total')}</TableHead>
                  <TableHead className="text-right">{t('ips.pageviews')}</TableHead>
                  <TableHead className="text-right">{t('ips.visitors')}</TableHead>
                  <TableHead className="text-right">{t('ips.errors')}</TableHead>
                  <TableHead className="text-right">{t('ips.requests')}</TableHead>
                  <TableHead className="text-right">{t('ips.lastSeen')}</TableHead>
                  <TableHead className="text-right">{t('ui.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((row) => (
                  <TableRow key={row.ip}>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        to={`/ips/${encodeURIComponent(row.ip)}`}
                        className="font-mono text-xs font-medium hover:underline"
                      >
                        {row.ip}
                      </Link>
                      {row.blocked ? (
                        <Badge variant="critical" className="ml-2">
                          <Ban aria-hidden />
                          {t('ips.blocked')}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-2 flex-1">
                          <div
                            className="h-2 rounded-r-[4px] bg-series-1"
                            style={{ width: `${Math.max(1, (row.total / max) * 100)}%` }}
                          />
                        </div>
                        <span className="w-12 text-right tabular-nums">{f.compact(row.total)}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.number(row.pageviews)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.number(row.visitors)}
                    </TableCell>
                    <TableCell
                      className={cn('text-right tabular-nums', row.errors > 0 && 'text-critical')}
                    >
                      {f.number(row.errors)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {f.number(row.requests)}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap text-muted-foreground">
                      {f.relative(row.lastSeen)}
                    </TableCell>
                    <TableCell className="text-right">
                      {!row.blocked ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={!canEdit || block.isPending}
                          title={canEdit ? undefined : t('ui.adminOnly')}
                          onClick={() => block.mutate({ ip: row.ip })}
                        >
                          <Ban />
                          {t('ips.block')}
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
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
          onChange={setPage}
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
