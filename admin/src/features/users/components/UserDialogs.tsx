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
import type { AdminUser, CreateUserInput, UpdateUserInput, UserRole } from '../types';

interface UserFormDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  user?: AdminUser;
  pending: boolean;
  error: unknown;
  onSubmit(input: CreateUserInput | UpdateUserInput): void;
}

export function UserFormDialog({
  open,
  onOpenChange,
  user,
  pending,
  error,
  onSubmit,
}: UserFormDialogProps) {
  const { t } = useTranslation();
  const isEdit = Boolean(user);
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(user?.role ?? 'monitor_viewer');
  const [fieldError, setFieldError] = useState<string | null>(null);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();
    if (trimmedName.length < 2 || trimmedName.length > 50) {
      setFieldError(t('users.validationName'));
      return;
    }
    if (!trimmedEmail.includes('@')) {
      setFieldError(t('users.validationEmail'));
      return;
    }
    if (!isEdit && password.length < 8) {
      setFieldError(t('users.validationPassword'));
      return;
    }
    setFieldError(null);
    if (isEdit) {
      onSubmit({ name: trimmedName, email: trimmedEmail, role });
    } else {
      onSubmit({ name: trimmedName, email: trimmedEmail, password, role });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>{isEdit ? t('users.edit') : t('users.create')}</DialogTitle>
            <DialogDescription>{t('users.roleHint')}</DialogDescription>
          </DialogHeader>
          <FormField label={t('users.name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </FormField>
          <FormField label={t('users.email')}>
            <Input value={email} type="email" onChange={(e) => setEmail(e.target.value)} />
          </FormField>
          {!isEdit ? (
            <FormField label={t('users.password')}>
              <Input
                value={password}
                type="password"
                autoComplete="new-password"
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>
          ) : null}
          <FormField label={t('users.role')}>
            <Select value={role} onChange={(e) => setRole(e.target.value as UserRole)} className="w-full">
              <option value="admin">{t('users.roles.admin')}</option>
              <option value="monitor_viewer">{t('users.roles.monitor_viewer')}</option>
              <option value="user">{t('users.roles.user')}</option>
            </Select>
          </FormField>
          {fieldError ? (
            <p role="alert" className="text-sm text-destructive">
              {fieldError}
            </p>
          ) : null}
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

interface DeleteUserDialogProps {
  open: boolean;
  onOpenChange(open: boolean): void;
  user: AdminUser;
  pending: boolean;
  onConfirm(): void;
}

export function DeleteUserDialog({
  open,
  onOpenChange,
  user,
  pending,
  onConfirm,
}: DeleteUserDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('users.delete')}</DialogTitle>
          <DialogDescription>
            {t('users.deleteConfirm', { name: user.name, email: user.email })}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t('common.cancel')}
            </Button>
          </DialogClose>
          <Button type="button" variant="destructive" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="animate-spin" /> : null}
            {t('users.delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
