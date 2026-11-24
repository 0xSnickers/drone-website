import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';
import { cn } from '@/core/utils/cn';

interface StatTileProps {
  label: string;
  value: string;
  /** 相对上一周期的变化比例；null 表示无法比较。 */
  change?: number | null;
  /** 上升是否是好事（错误数上升是坏事）。 */
  upIsGood?: boolean;
  formatChange?(ratio: number): string;
  compareLabel?: string;
  noChangeLabel?: string;
  dimmed?: boolean;
}

/** 指标卡：标签 · 数值 · 环比（方向 × 好坏决定颜色，并配图标，不只靠颜色）。 */
export function StatTile({
  label,
  value,
  change,
  upIsGood = true,
  formatChange,
  compareLabel,
  noChangeLabel,
  dimmed,
}: StatTileProps) {
  const hasChange = change !== undefined && change !== null && formatChange;
  const flat = hasChange && Math.abs(change) < 0.005;
  const good = hasChange && !flat && change > 0 === upIsGood;
  const Icon = !hasChange || flat ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className={cn('rounded-lg border bg-card p-4 transition-opacity', dimmed && 'opacity-60')}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
      {hasChange ? (
        <p
          className={cn(
            'mt-1 flex items-center gap-1 text-xs',
            flat ? 'text-muted-foreground' : good ? 'text-success' : 'text-critical',
          )}
        >
          <Icon className="size-3.5" aria-hidden />
          <span className="tabular-nums">
            {flat ? noChangeLabel : `${change > 0 ? '+' : ''}${formatChange(change)}`}
          </span>
          <span className="text-muted-foreground">{compareLabel}</span>
        </p>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">&nbsp;</p>
      )}
    </div>
  );
}
