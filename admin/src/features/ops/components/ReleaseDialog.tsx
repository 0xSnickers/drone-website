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
import { Select } from '@/components/ui/select';
import { getErrorMessage } from '@/core/http/apiError';
import type { CreateReleaseInput, ReleaseEnv, ReleaseStatus } from '../types';

interface ReleaseDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  pending: boolean;
  error: unknown;
  onSubmit(input: CreateReleaseInput): void;
}

export function ReleaseDialog({
  open,
  onOpenChange,
  pending,
  error,
  onSubmit,
}: ReleaseDialogProps) {
  const { t } = useTranslation();
  const [version, setVersion] = useState('');
  const [environment, setEnvironment] = useState<ReleaseEnv>('production');
  const [branch, setBranch] = useState('main');
  const [commitSha, setCommitSha] = useState('');
  const [status, setStatus] = useState<ReleaseStatus>('success');
  const [notes, setNotes] = useState('');
  const [invalid, setInvalid] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = version.trim();
    if (!trimmed) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    onSubmit({
      version: trimmed,
      environment,
      branch: branch.trim() || 'main',
      commitSha: commitSha.trim(),
      status,
      notes: notes.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('ops.releases.create')}</DialogTitle>
            <DialogDescription>{t('ops.releases.createHint')}</DialogDescription>
          </DialogHeader>
          <FormField
            label={t('ops.releases.version')}
            error={invalid ? t('ops.releases.versionRequired') : null}
          >
            <Input
              value={version}
              placeholder="v1.1.0"
              onChange={(e) => setVersion(e.target.value)}
              autoFocus
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('ops.releases.environment')}>
              <Select
                value={environment}
                onChange={(e) => setEnvironment(e.target.value as ReleaseEnv)}
                className="w-full"
              >
                <option value="production">production</option>
                <option value="staging">staging</option>
                <option value="development">development</option>
              </Select>
            </FormField>
            <FormField label={t('ops.releases.status')}>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as ReleaseStatus)}
                className="w-full"
              >
                <option value="success">{t('ops.releases.statuses.success')}</option>
                <option value="running">{t('ops.releases.statuses.running')}</option>
                <option value="failed">{t('ops.releases.statuses.failed')}</option>
                <option value="rolled_back">{t('ops.releases.statuses.rolled_back')}</option>
              </Select>
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField label={t('ops.releases.branch')}>
              <Input value={branch} onChange={(e) => setBranch(e.target.value)} />
            </FormField>
            <FormField label={t('ops.releases.commit')}>
              <Input
                value={commitSha}
                placeholder="a1b2c3d4"
                onChange={(e) => setCommitSha(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label={t('ops.releases.notes')}>
            <Input
              value={notes}
              placeholder={t('ops.releases.notesPlaceholder')}
              onChange={(e) => setNotes(e.target.value)}
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
