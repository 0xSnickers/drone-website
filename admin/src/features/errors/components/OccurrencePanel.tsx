import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { StateMessage } from '@/components/ui/state';
import { useFormat } from '@/hooks/useFormat';
import { useIssueEvents } from '../hooks/useIssues';
import type { ErrorOccurrence } from '../types';

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-all">{children}</dd>
    </>
  );
}

/** 一次发生的现场：环境、堆栈、操作路径。 */
function OccurrenceDetail({ occurrence: o }: { occurrence: ErrorOccurrence }) {
  const { t } = useTranslation();
  const f = useFormat();
  const extra = Object.keys(o.extra ?? {}).length ? JSON.stringify(o.extra, null, 2) : null;
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[max-content_1fr] gap-x-6 gap-y-1.5 text-sm">
        <Field label={t('ui.time')}>{f.dateTime(o.createdAt)}</Field>
        <Field label={t('events.page')}>{o.url}</Field>
        <Field label={t('errors.environment')}>{`${o.browser} · ${o.os} · ${o.device}`}</Field>
        <Field label={t('events.ip')}>{o.ip}</Field>
        <Field label={t('events.visitor')}>
          <span className="font-mono text-xs">{o.visitorId}</span>
          {o.userId ? <span className="ml-2 text-muted-foreground">({o.userId})</span> : null}
        </Field>
        {o.release ? <Field label={t('errors.release')}>{o.release}</Field> : null}
      </dl>
      <div className="space-y-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">{t('errors.stack')}</h3>
        {o.stack ? (
          <pre className="max-h-72 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
            {o.stack}
          </pre>
        ) : (
          <p className="text-sm text-muted-foreground">{t('errors.noStack')}</p>
        )}
      </div>
      <div className="space-y-1.5">
        <h3 className="text-xs font-medium text-muted-foreground">{t('errors.breadcrumbs')}</h3>
        {o.breadcrumbs?.length ? (
          <ol className="space-y-1 border-l pl-4 text-sm">
            {o.breadcrumbs.map((b, i) => (
              <li key={i} className="flex gap-3">
                <span className="w-20 shrink-0 text-xs text-muted-foreground tabular-nums">
                  {new Date(b.ts).toLocaleTimeString(f.locale, { hour12: false })}
                </span>
                <span className="w-16 shrink-0 text-xs text-muted-foreground">{b.type}</span>
                <span className="min-w-0 break-all">{b.message}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-sm text-muted-foreground">{t('errors.noBreadcrumbs')}</p>
        )}
      </div>
      {extra ? (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium text-muted-foreground">{t('errors.extra')}</h3>
          <pre className="overflow-auto rounded-md bg-muted p-3 font-mono text-xs">{extra}</pre>
        </div>
      ) : null}
    </div>
  );
}

/** 发生记录：分页浏览，每页最新一条展开显示现场。 */
export function OccurrencePanel({ issueId }: { issueId: string }) {
  const { t } = useTranslation();
  const f = useFormat();
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(0);
  const query = useIssueEvents(issueId, page);
  const items = query.data?.items ?? [];
  const current = items[Math.min(selected, items.length - 1)];

  return (
    <Card>
      <CardHeader title={t('errors.occurrences')} />
      <CardContent className="space-y-4">
        {!query.data ? (
          <StateMessage kind={query.isError ? 'error' : 'loading'}>
            {query.isError ? t('ui.loadFailed') : t('common.loading')}
          </StateMessage>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {items.map((o, i) => (
                <button
                  key={o.id}
                  type="button"
                  role="tab"
                  aria-selected={o === current}
                  onClick={() => setSelected(i)}
                  className="rounded-md border px-2 py-1 text-xs text-muted-foreground hover:bg-accent aria-selected:border-primary aria-selected:text-foreground"
                >
                  {f.relative(o.createdAt)} · {o.browser}
                </button>
              ))}
            </div>
            {current ? <OccurrenceDetail occurrence={current} /> : null}
            <Pagination
              page={query.data.pagination.page}
              totalPages={query.data.pagination.totalPages}
              onChange={(p) => {
                setPage(p);
                setSelected(0);
              }}
              labels={{
                prev: t('ui.prev'),
                next: t('ui.next'),
                summary: t('ui.total', { total: query.data.pagination.total }),
              }}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}
