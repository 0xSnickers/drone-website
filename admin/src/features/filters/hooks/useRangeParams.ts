import { useMemo } from 'react';
import { browserTimeZone } from '@/lib/format';
import type { RangeParams } from '@/types/monitor';
import { useFiltersStore } from '../store/filtersStore';

/** 当前筛选 -> 接口参数（附带浏览器时区，后端按当地时间切分小时 / 天）。 */
export function useRangeParams(): RangeParams {
  const projectId = useFiltersStore((s) => s.projectId);
  const range = useFiltersStore((s) => s.range);
  return useMemo(
    () => ({ projectId: projectId ?? undefined, range, tz: browserTimeZone() }),
    [projectId, range],
  );
}
