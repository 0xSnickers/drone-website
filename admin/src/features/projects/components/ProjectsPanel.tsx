import { useState } from 'react';
import { KeyRound, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { StateMessage } from '@/components/ui/state';
import { useFormat } from '@/hooks/useFormat';
import { useProjectMutations, useProjects } from '../hooks/useProjects';
import type { Project } from '../types';
import { CopyButton } from './CopyButton';
import { IntegrationGuide } from './IntegrationGuide';
import { ConfirmDialog, ProjectFormDialog } from './ProjectDialogs';

type Dialog = { kind: 'create' } | { kind: 'edit' | 'delete' | 'rotate'; project: Project } | null;

/** 项目列表：appKey、接入指引；管理员可新建 / 编辑 / 重置 appKey / 删除。 */
export function ProjectsPanel({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const projects = useProjects();
  const { create, update, rotate, remove } = useProjectMutations();
  const [dialog, setDialog] = useState<Dialog>(null);
  const close = () => setDialog(null);
  const items = projects.data?.items;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          disabled={!canEdit}
          title={canEdit ? undefined : t('ui.adminOnly')}
          onClick={() => {
            create.reset();
            setDialog({ kind: 'create' });
          }}
        >
          <Plus />
          {t('projects.create')}
        </Button>
      </div>
      {!items ? (
        <StateMessage kind={projects.isError ? 'error' : 'loading'}>
          {projects.isError ? t('ui.loadFailed') : t('common.loading')}
        </StateMessage>
      ) : items.length === 0 ? (
        <StateMessage kind="empty">{t('projects.empty')}</StateMessage>
      ) : (
        items.map((p) => (
          <Card key={p.id}>
            <CardHeader
              title={p.name}
              description={`${p.description || '—'} · ${t('projects.createdAt')} ${f.dateTime(p.createdAt)}`}
              actions={
                canEdit ? (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        update.reset();
                        setDialog({ kind: 'edit', project: p });
                      }}
                    >
                      <Pencil />
                      {t('projects.edit')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDialog({ kind: 'rotate', project: p })}
                    >
                      <KeyRound />
                      {t('projects.rotate')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      onClick={() => setDialog({ kind: 'delete', project: p })}
                    >
                      <Trash2 />
                      {t('projects.delete')}
                    </Button>
                  </>
                ) : null
              }
            />
            <CardContent className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted-foreground">{t('projects.appKey')}</span>
                <code className="rounded bg-muted px-2 py-1 font-mono text-xs">{p.appKey}</code>
                <CopyButton text={p.appKey} />
              </div>
              <details className="group">
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  {t('projects.integration')}
                </summary>
                <div className="mt-3">
                  <IntegrationGuide appKey={p.appKey} />
                </div>
              </details>
            </CardContent>
          </Card>
        ))
      )}

      {dialog?.kind === 'create' ? (
        <ProjectFormDialog
          open
          onOpenChange={close}
          pending={create.isPending}
          error={create.error}
          onSubmit={(input) => create.mutate(input, { onSuccess: close })}
        />
      ) : null}
      {dialog?.kind === 'edit' ? (
        <ProjectFormDialog
          open
          onOpenChange={close}
          project={dialog.project}
          pending={update.isPending}
          error={update.error}
          onSubmit={(input) =>
            update.mutate({ id: dialog.project.id, input }, { onSuccess: close })
          }
        />
      ) : null}
      {dialog?.kind === 'rotate' ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t('projects.rotate')}
          description={t('projects.rotateConfirm')}
          confirmLabel={t('projects.rotate')}
          pending={rotate.isPending}
          onConfirm={() => rotate.mutate(dialog.project.id, { onSuccess: close })}
        />
      ) : null}
      {dialog?.kind === 'delete' ? (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t('projects.delete')}
          description={t('projects.deleteConfirm', { name: dialog.project.name })}
          confirmLabel={t('projects.delete')}
          pending={remove.isPending}
          onConfirm={() => remove.mutate(dialog.project.id, { onSuccess: close })}
        />
      ) : null}
    </div>
  );
}
