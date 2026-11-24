import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  formatBucket,
  formatCompact,
  formatDateTime,
  formatMs,
  formatNumber,
  formatPercent,
  formatRelative,
} from '@/lib/format';
import type { Bucket } from '@/types/monitor';

/** 绑定当前语言的格式化函数。 */
export function useFormat() {
  const { i18n } = useTranslation();
  const locale = i18n.language;
  return useMemo(
    () => ({
      locale,
      number: (v: number) => formatNumber(v, locale),
      compact: (v: number) => formatCompact(v, locale),
      percent: (v: number, digits?: number) => formatPercent(v, locale, digits),
      ms: (v: number) => formatMs(v, locale),
      dateTime: (v: string | Date) => formatDateTime(v, locale),
      relative: (v: string | Date) => formatRelative(v, locale),
      bucket: (v: string | Date, bucket: Bucket) => formatBucket(v, bucket, locale),
      bucketLong: (v: string | Date, bucket: Bucket) =>
        bucket === 'day'
          ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(v))
          : new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
              new Date(v),
            ),
    }),
    [locale],
  );
}
