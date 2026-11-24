import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import { PageHeader } from '@/components/layout/PageHeader';
import { EventStream, EventSummaryCard } from '@/features/events';
import { useRangeParams } from '@/features/filters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function EventsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('events.title'));
  const params = useRangeParams();
  // 事件名放在 URL 里，筛选结果可以分享。
  const [search, setSearch] = useSearchParams();
  const name = search.get('name') ?? undefined;
  const setName = (value: string | undefined) =>
    setSearch(value ? { name: value } : {}, { replace: true });

  return (
    <>
      <PageHeader title={t('events.title')} description={t('events.description')} />
      <div className="space-y-4">
        <EventSummaryCard params={params} selected={name} onSelect={setName} />
        <EventStream
          key={name ?? 'all'}
          params={params}
          initial={{ name }}
          onClearName={() => setName(undefined)}
        />
      </div>
    </>
  );
}
