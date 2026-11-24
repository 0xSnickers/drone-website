import type { Bucket } from '@/types/monitor';

/** 1,284 / 12.9K / 4.2M（中文环境：1.3万）。 */
export function formatCompact(value: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: value >= 10_000 ? 'compact' : 'standard',
    maximumFractionDigits: 1,
  }).format(value);
}

export function formatNumber(value: number, locale: string) {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatPercent(value: number, locale: string, digits = 1) {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(
    value,
  );
}

/** 毫秒 -> `85 ms` / `1.7 s` */
export function formatMs(ms: number, locale: string) {
  if (ms < 1000) return `${formatNumber(Math.round(ms), locale)} ms`;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(ms / 1000)} s`;
}

export function formatDateTime(value: string | Date, locale: string) {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'medium' }).format(
    new Date(value),
  );
}

/** 相对时间：3 分钟前 / in 2 hours。 */
export function formatRelative(value: string | Date, locale: string, now = Date.now()) {
  const diff = (new Date(value).getTime() - now) / 1000;
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
  const abs = Math.abs(diff);
  if (abs < 60) return rtf.format(Math.round(diff), 'second');
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute');
  if (abs < 86_400) return rtf.format(Math.round(diff / 3600), 'hour');
  return rtf.format(Math.round(diff / 86_400), 'day');
}

/** 图表 X 轴：按时间桶粒度显示 14:05 / 14:00 / 10/24。 */
export function formatBucket(value: string | Date, bucket: Bucket, locale: string) {
  const date = new Date(value);
  if (bucket === 'day')
    return new Intl.DateTimeFormat(locale, { month: 'numeric', day: 'numeric' }).format(date);
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);
}

/** 环比：current 相对 previous 的变化比例；previous 为 0 时无法计算。 */
export function changeRatio(current: number, previous: number) {
  if (!previous) return null;
  return (current - previous) / previous;
}

export const browserTimeZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};
