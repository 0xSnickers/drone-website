import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/core/utils/cn';
import { niceTicks, useElementWidth } from './use-element-width';

export type SeriesColor = 'series-1' | 'series-2' | 'series-3';
export interface LineSeries<K extends string = string> {
  key: K;
  label: string;
  color: SeriesColor;
}

export interface LineChartProps<K extends string> {
  data: ({ bucket: string } & Record<K, number>)[];
  series: LineSeries<K>[];
  ariaLabel: string;
  formatX(bucket: string): string;
  formatTooltipX(bucket: string): string;
  formatValue(value: number): string;
  formatTick?(value: number): string;
  height?: number;
  /** 刷新中：保持上一帧并降低不透明度，不闪烁。 */
  dimmed?: boolean;
}

const PAD = { top: 12, right: 12, bottom: 24, left: 44 };

/**
 * 折线图（单 Y 轴）。2px 线、单系列带 10% 面积底色、十字准线 + 全系列 tooltip，
 * 键盘可用（←/→ 移动）。≥2 个系列时显示图例；原始数值可通过 ChartCard 切换为表格。
 */
export function LineChart<K extends string>({
  data,
  series,
  ariaLabel,
  formatX,
  formatTooltipX,
  formatValue,
  formatTick = formatValue,
  height = 200,
  dimmed,
}: LineChartProps<K>) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const innerW = width - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const max = Math.max(1, ...data.flatMap((d) => series.map((s) => d[s.key])));
  const ticks = niceTicks(max);
  const yMax = ticks[ticks.length - 1] ?? max;
  const x = (i: number) =>
    PAD.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => PAD.top + innerH - (v / yMax) * innerH;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(innerW / 72))));

  const pathOf = (key: K) =>
    data.map((d, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join('');

  const onPointerMove = (event: PointerEvent<SVGRectElement>) => {
    if (!data.length) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / rect.width;
    setActive(Math.min(data.length - 1, Math.max(0, Math.round(ratio * (data.length - 1)))));
  };
  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' ? -1 : 1;
    setActive((i) => Math.min(data.length - 1, Math.max(0, (i ?? data.length - 1) + delta)));
  };

  const point = active === null ? undefined : data[active];

  return (
    <div className={cn('space-y-2 transition-opacity', dimmed && 'opacity-60')}>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-4 text-xs text-muted-foreground" aria-hidden>
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span
                className="h-0.5 w-3 rounded-full"
                style={{ background: `var(--${s.color})` }}
              />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <div ref={ref} className="relative w-full min-w-0">
        <svg
          width={width}
          style={{ maxWidth: '100%' }}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          className="block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          onKeyDown={onKeyDown}
          onFocus={() => setActive(data.length - 1)}
          onBlur={() => setActive(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(t)}
                y2={y(t)}
                stroke={t === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'}
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(t)}
                dy="0.32em"
                textAnchor="end"
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {formatTick(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            // 均匀取样 + 必定显示最后一个；离最后一个太近的常规标签跳过，避免重叠。
            i === data.length - 1 || (i % labelEvery === 0 && data.length - 1 - i >= labelEvery) ? (
              <text
                key={d.bucket}
                x={x(i)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
                className="fill-muted-foreground text-[10px] tabular-nums"
              >
                {formatX(d.bucket)}
              </text>
            ) : null,
          )}
          {series.length === 1 && data.length > 1 && series[0] ? (
            <path
              d={`${pathOf(series[0].key)}L${x(data.length - 1)},${y(0)}L${x(0)},${y(0)}Z`}
              fill={`var(--${series[0].color})`}
              fillOpacity={0.1}
            />
          ) : null}
          {series.map((s) => (
            <path
              key={s.key}
              d={pathOf(s.key)}
              fill="none"
              stroke={`var(--${s.color})`}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          ))}
          {point && active !== null ? (
            <g>
              <line
                x1={x(active)}
                x2={x(active)}
                y1={PAD.top}
                y2={PAD.top + innerH}
                stroke="var(--chart-axis)"
                strokeWidth={1}
              />
              {series.map((s) => (
                <circle
                  key={s.key}
                  cx={x(active)}
                  cy={y(point[s.key])}
                  r={4}
                  fill={`var(--${s.color})`}
                  stroke="var(--card)"
                  strokeWidth={2}
                />
              ))}
            </g>
          ) : null}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={Math.max(0, innerW)}
            height={Math.max(0, innerH)}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
        {point && active !== null ? (
          <div
            role="status"
            className="pointer-events-none absolute top-0 z-10 min-w-36 rounded-md border bg-popover px-3 py-2 text-xs shadow-md"
            style={{
              left: Math.min(Math.max(x(active) + 12, 0), width - 160),
              transform:
                x(active) > width - 180 ? 'translateX(-100%) translateX(-24px)' : undefined,
            }}
          >
            <p className="mb-1 text-muted-foreground">{formatTooltipX(point.bucket)}</p>
            {series.map((s) => (
              <p key={s.key} className="flex items-center gap-2">
                <span
                  className="h-0.5 w-3 shrink-0 rounded-full"
                  style={{ background: `var(--${s.color})` }}
                />
                <span className="font-semibold text-foreground tabular-nums">
                  {formatValue(point[s.key])}
                </span>
                <span className="text-muted-foreground">{s.label}</span>
              </p>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
