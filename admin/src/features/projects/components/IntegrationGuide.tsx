import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { CopyButton } from './CopyButton';
import { integrationSnippets, type SnippetKey } from './snippets';

const TABS: SnippetKey[] = ['npm', 'script', 'template', 'backend'];

/** 接入指引：按项目 appKey 生成可直接复制的代码。 */
export function IntegrationGuide({ appKey }: { appKey: string }) {
  const { t } = useTranslation();
  const [tab, setTab] = useState<SnippetKey>('npm');
  const endpoint = `${window.location.origin}/api/v1`;
  const code = integrationSnippets(appKey, endpoint)[tab];
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{t('projects.integrationHint')}</p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" className="flex flex-wrap gap-1">
          {TABS.map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={cn(
                'rounded-md px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent',
                tab === key && 'bg-accent font-medium text-foreground',
              )}
            >
              {t(`projects.tabs.${key}`)}
            </button>
          ))}
        </div>
        <CopyButton text={code} />
      </div>
      <pre className="max-h-80 overflow-auto rounded-md bg-muted p-3 font-mono text-xs leading-relaxed">
        {code}
      </pre>
    </div>
  );
}
