import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StateMessage } from '@/components/ui/state';
import { getErrorMessage } from '@/core/http/apiError';
import { useFormat } from '@/hooks/useFormat';
import { useIpRuleMutations, useIpRules } from '../hooks/useIps';

/** 黑名单：添加 / 移除。 */
export function IpRulesCard({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const rules = useIpRules();
  const { block, unblock } = useIpRuleMutations();
  const [ip, setIp] = useState('');
  const [note, setNote] = useState('');

  return (
    <Card>
      <CardHeader title={t('ips.rules')} description={t('ips.rulesHint')} />
      <CardContent className="space-y-4">
        {canEdit ? (
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!ip.trim()) return;
              block.mutate(
                { ip: ip.trim(), note: note.trim() || undefined },
                {
                  onSuccess: () => {
                    setIp('');
                    setNote('');
                  },
                },
              );
            }}
          >
            <Input
              className="w-40 font-mono"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="203.0.113.1"
              aria-label={t('ips.ip')}
            />
            <Input
              className="w-48"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t('ips.note')}
              aria-label={t('ips.note')}
            />
            <Button type="submit" size="sm" className="h-9" disabled={block.isPending}>
              <Plus />
              {t('ips.addRule')}
            </Button>
            {block.error ? (
              <p role="alert" className="w-full text-sm text-destructive">
                {getErrorMessage(block.error, t('ui.loadFailed'))}
              </p>
            ) : null}
          </form>
        ) : null}
        {!rules.data ? (
          <StateMessage kind={rules.isError ? 'error' : 'loading'}>
            {rules.isError ? t('ui.loadFailed') : t('common.loading')}
          </StateMessage>
        ) : rules.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('ips.noRules')}</p>
        ) : (
          <ul className="divide-y rounded-md border">
            {rules.data.map((r) => (
              <li
                key={r.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <Link
                    to={`/ips/${encodeURIComponent(r.ip)}`}
                    className="font-mono text-xs font-medium hover:underline"
                  >
                    {r.ip}
                  </Link>
                  <span className="ml-3 text-xs text-muted-foreground">
                    {r.note || '—'} · {f.relative(r.createdAt)}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={!canEdit || unblock.isPending}
                  onClick={() => unblock.mutate(r.id)}
                >
                  <Trash2 />
                  {t('ips.unblock')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
