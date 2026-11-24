import type { ReactNode } from 'react';
import { cn } from '@/core/utils/cn';

export interface BarListItem {
  key: string;
  label: ReactNode;
  value: number;
  /** 条形右侧显示的值（已格式化）。 */
  display: string;
  /** 次要数值，如 UV。 */
  secondary?: string;
}

/**
 * 排行条形图：一个系列一种颜色，条形 8px、末端 4px 圆角，从同一基线生长。
 * 数值直接标在行尾，不依赖悬停。
 */
export function BarList({
  items,
  className,
  dimmed,
}: {
  items: BarListItem[];
  className?: string;
  dimmed?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className={cn('space-y-2.5 transition-opacity', dimmed && 'opacity-60', className)}>
      {items.map((item) => (
        <li key={item.key} className="group rounded-sm px-1 py-0.5 hover:bg-muted/60">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{item.label}</span>
            <span className="shrink-0 tabular-nums">
              <span className="font-medium">{item.display}</span>
              {item.secondary ? (
                <span className="ml-2 text-xs text-muted-foreground">{item.secondary}</span>
              ) : null}
            </span>
          </div>
          <div className="mt-1 h-2">
            <div
              className="h-2 rounded-r-[4px] bg-series-1 group-hover:opacity-80"
              style={{ width: `${Math.max(1, (item.value / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
