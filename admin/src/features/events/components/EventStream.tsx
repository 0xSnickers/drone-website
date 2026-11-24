import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
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
import { useEvents } from '../hooks/useEvents';
import type { EventFilters, EventType } from '../types';

const TYPES: EventType[] = ['track', 'pageview', 'performance'];

const shortProps = (props: Record<string, unknown>) => {
  const text = JSON.stringify(props);
  return text === '{}' ? '' : text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

/** 行为明细流：类型 / 事件名 / 访客 / IP 筛选。 */
export function EventStream({
  params,
  initial,
  onClearName,
}: {
  params: RangeParams;
  initial: EventFilters;
  onClearName(): void;
}) {
  const { t } = useTranslation();
  const f = useFormat();
  const [type, setType] = useState<EventType | undefined>('track');
  const [page, setPage] = useState(1);
  const filters: EventFilters = {
    ...initial,
    type: initial.name ? 'track' : type,
    page,
    limit: 20,
  };
  const query = useEvents({ ...params, ...filters });
  const data = query.data;

  return (
    <Card>
      <CardHeader
        title={t('events.stream')}
        actions={
          <>
            {initial.name || initial.visitorId || initial.ip ? (
              <Button variant="outline" size="sm" onClick={onClearName}>
                <X />
                {initial.name ?? initial.visitorId ?? initial.ip}
              </Button>
            ) : null}
            <Select
              aria-label={t('events.type')}
              value={filters.type ?? ''}
              disabled={Boolean(initial.name)}
              onChange={(e) => {
                setType((e.target.value || undefined) as EventType | undefined);
                setPage(1);
              }}
            >
              <option value="">{`${t('events.type')}: ${t('ui.all')}`}</option>
              {TYPES.map((tp) => (
                <option key={tp} value={tp}>
                  {t(`events.types.${tp}`)}
                </option>
              ))}
            </Select>
          </>
        }
      />
      <CardContent className="space-y-3 p-0 pb-4">
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
                <TableHead>{t('ui.time')}</TableHead>
                <TableHead>{t('events.name')}</TableHead>
                <TableHead>{t('events.page')}</TableHead>
                <TableHead>{t('events.properties')}</TableHead>
                <TableHead>{t('events.visitor')}</TableHead>
                <TableHead>{t('events.ip')}</TableHead>
                <TableHead>{t('events.device')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground tabular-nums">
                    {f.dateTime(e.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Badge variant={e.type === 'track' ? 'primary' : 'outline'}>
                      {t(`events.types.${e.type}`)}
                    </Badge>
                    <span className="ml-2 font-mono text-xs">
                      {e.type === 'pageview' ? '' : e.name}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-56 truncate font-mono text-xs" title={e.url}>
                    {e.path}
                  </TableCell>
                  <TableCell
                    className="max-w-64 truncate font-mono text-xs text-muted-foreground"
                    title={JSON.stringify(e.properties)}
                  >
                    {shortProps(e.properties)}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.userId ?? e.visitorId.slice(0, 8)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Link
                      to={`/ips/${encodeURIComponent(e.ip)}`}
                      className="font-mono text-xs hover:underline"
                    >
                      {e.ip}
                    </Link>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{`${e.browser} · ${e.os}`}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data ? (
          <div className="px-4">
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
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
