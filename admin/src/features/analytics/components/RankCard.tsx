import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BarList, type BarListItem } from '@/components/charts/bar-list';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StateMessage } from '@/components/ui/state';

interface RankCardProps {
  title: ReactNode;
  description?: ReactNode;
  items: BarListItem[] | undefined;
  isError?: boolean;
  isFetching?: boolean;
  actions?: ReactNode;
}

/** 排行卡片（页面、来源、浏览器……）。 */
export function RankCard({
  title,
  description,
  items,
  isError,
  isFetching,
  actions,
}: RankCardProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader title={title} description={description} actions={actions} />
      <CardContent>
        {!items ? (
          <StateMessage kind={isError ? 'error' : 'loading'}>
            {isError ? t('ui.loadFailed') : t('common.loading')}
          </StateMessage>
        ) : items.length === 0 ? (
          <StateMessage kind="empty">{t('common.empty')}</StateMessage>
        ) : (
          <BarList items={items} dimmed={isFetching} />
        )}
      </CardContent>
    </Card>
  );
}
