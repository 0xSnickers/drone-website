import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { storageKey } from '@/core/utils/storage';
import { RANGES, type RangeKey } from '@/types/monitor';

interface FiltersState {
  /** null = 全部项目 */
  projectId: string | null;
  range: RangeKey;
  setProjectId(projectId: string | null): void;
  setRange(range: RangeKey): void;
}

/** 全局筛选（项目 + 时间范围）：跨页面共享并持久化，所有监控页面都按它取数。 */
export const useFiltersStore = create<FiltersState>()(
  persist(
    (set) => ({
      projectId: null,
      range: '24h',
      setProjectId: (projectId) => set({ projectId }),
      setRange: (range) => set({ range: RANGES.includes(range) ? range : '24h' }),
    }),
    {
      name: storageKey('monitor-filters'),
      storage: createJSONStorage(() => window.localStorage),
      partialize: ({ projectId, range }) => ({ projectId, range }),
    },
  ),
);
