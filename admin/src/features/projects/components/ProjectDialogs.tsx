import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { getErrorMessage } from '@/core/http/apiError';
import type { Project, ProjectInput } from '../types';

interface ProjectFormDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  project?: Project;
  pending: boolean;
  error: unknown;
  onSubmit(input: ProjectInput): void;
}

/** 新建 / 编辑项目。 */
export function ProjectFormDialog({
  open,
  onOpenChange,
  project,
  pending,
  error,
  onSubmit,
}: ProjectFormDialogProps) {
  const { t } = useTranslation();
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [invalid, setInvalid] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 50) return setInvalid(true);
    setInvalid(false);
    onSubmit({ name: trimmed, description: description.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{project ? t('projects.edit') : t('projects.create')}</DialogTitle>
          </DialogHeader>
          <FormField label={t('projects.name')} error={invalid ? t('projects.nameRequired') : null}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </FormField>
          <FormField label={t('projects.descriptionField')}>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </FormField>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {getErrorMessage(error, t('ui.loadFailed'))}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline">
                {t('common.cancel')}
              </Button>
            </DialogClose>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {t('projects.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  title: string;
  description: string;
  confirmLabel: string;
  pending: boolean;
  onConfirm(): void;
}

/** 危险操作确认（删除、重置 appKey）。 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pending,
  onConfirm,
}: ConfirmDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
