import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Select } from '@/components/ui/select';
import { useProjects } from '@/features/projects';
import { RANGES, type RangeKey } from '@/types/monitor';
import { useFiltersStore } from '../store/filtersStore';

/** 全局筛选：项目 + 时间范围。位于页面顶部，作用于下方所有图表和表格。 */
export function FilterBar() {
  const { t } = useTranslation();
  const { projectId, range, setProjectId, setRange } = useFiltersStore();
  const projects = useProjects();
  const items = projects.data?.items;

  // 已选项目被删除后回到「全部项目」。
  useEffect(() => {
    if (projectId && items && !items.some((p) => p.id === projectId)) setProjectId(null);
  }, [items, projectId, setProjectId]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="sr-only" htmlFor="filter-range">
        {t('filters.range')}
      </label>
      <Select
        id="filter-range"
        value={range}
        onChange={(e) => setRange(e.target.value as RangeKey)}
        className="w-36"
      >
        {RANGES.map((r) => (
          <option key={r} value={r}>
            {t(`filters.ranges.${r}`)}
          </option>
        ))}
      </Select>
      <label className="sr-only" htmlFor="filter-project">
        {t('filters.project')}
      </label>
      <Select
        id="filter-project"
        value={projectId ?? ''}
        onChange={(e) => setProjectId(e.target.value || null)}
        className="w-44"
      >
        <option value="">{t('filters.allProjects')}</option>
        {items?.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
