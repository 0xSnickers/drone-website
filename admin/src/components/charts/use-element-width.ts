import { useEffect, useRef, useState } from 'react';

/** 监听容器宽度，让 SVG 按真实像素绘制（线宽、字号不随缩放变形）。 */
export function useElementWidth<T extends HTMLElement>(fallback = 600) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    setWidth(Math.max(240, Math.floor(el.getBoundingClientRect().width) || fallback));
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(240, Math.floor(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fallback]);

  return [ref, width] as const;
}

/** 0 / 1 / 2 / 5 × 10^n 的整齐刻度。 */
export function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * magnitude).find((s) => s >= raw) ?? raw;
  const ticks: number[] = [];
  for (let v = 0; v < max + step; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
