import { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { StateMessage } from '@/components/ui/state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useAuth } from '@/features/auth';
import { useFormat } from '@/hooks/useFormat';
import { useUserMutations, useUsers } from '../hooks/useUsers';
import type { AdminUser, CreateUserInput, UpdateUserInput, UserRole } from '../types';
import { DeleteUserDialog, UserFormDialog } from './UserDialogs';

type DialogState = { kind: 'create' } | { kind: 'edit' | 'delete'; user: AdminUser } | null;

function roleBadgeVariant(role: UserRole): 'primary' | 'default' | 'outline' {
  if (role === 'admin') return 'primary';
  if (role === 'monitor_viewer') return 'default';
  return 'outline';
}

export function UsersPanel({ canEdit }: { canEdit: boolean }) {
  const { t } = useTranslation();
  const f = useFormat();
  const { user: currentUser } = useAuth();
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState<DialogState>(null);
  const users = useUsers(page, 10, canEdit);
  const { create, update, remove } = useUserMutations();
  const close = () => setDialog(null);

  if (!canEdit) {
    return <StateMessage kind="empty">{t('users.adminRequired')}</StateMessage>;
  }

  const data = users.data;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          onClick={() => {
            create.reset();
            setDialog({ kind: 'create' });
          }}
        >
          <Plus />
          {t('users.create')}
        </Button>
      </div>

      {!data ? (
        <StateMessage kind={users.isError ? 'error' : 'loading'}>
          {users.isError ? t('ui.loadFailed') : t('common.loading')}
        </StateMessage>
      ) : data.items.length === 0 ? (
        <StateMessage kind="empty">{t('users.empty')}</StateMessage>
      ) : (
        <Card className={users.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <CardContent className="space-y-4 pt-6">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('users.name')}</TableHead>
                  <TableHead>{t('users.email')}</TableHead>
                  <TableHead>{t('users.role')}</TableHead>
                  <TableHead>{t('users.portal')}</TableHead>
                  <TableHead>{t('users.createdAt')}</TableHead>
                  <TableHead className="text-right">{t('ui.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((item) => {
                  const isSelf = currentUser?.id === item.id;
                  const portalKey = item.role === 'user' ? 'users.portalWeb' : 'users.portalAdmin';
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">
                        {item.name}
                        {isSelf ? (
                          <Badge variant="outline" className="ml-2">
                            {t('users.you')}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{item.email}</TableCell>
                      <TableCell>
                        <Badge variant={roleBadgeVariant(item.role)}>
                          {t(`users.roles.${item.role}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{t(portalKey)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {f.dateTime(item.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              update.reset();
                              setDialog({ kind: 'edit', user: item });
                            }}
                          >
                            <Pencil />
                            {t('projects.edit')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={isSelf}
                            title={isSelf ? t('users.cannotDeleteSelf') : undefined}
                            onClick={() => setDialog({ kind: 'delete', user: item })}
                          >
                            <Trash2 />
                            {t('users.delete')}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            <Pagination
              page={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onChange={setPage}
              labels={{
                prev: t('ui.prev'),
                next: t('ui.next'),
                summary: t('ui.total', { total: data.pagination.total }),
              }}
            />
          </CardContent>
        </Card>
      )}

      {dialog?.kind === 'create' ? (
        <UserFormDialog
          open
          onOpenChange={close}
          pending={create.isPending}
          error={create.error}
          onSubmit={(input) => create.mutate(input as CreateUserInput, { onSuccess: close })}
        />
      ) : null}

      {dialog?.kind === 'edit' ? (
        <UserFormDialog
          open
          onOpenChange={close}
          user={dialog.user}
          pending={update.isPending}
          error={update.error}
          onSubmit={(input) =>
            update.mutate({ id: dialog.user.id, input: input as UpdateUserInput }, { onSuccess: close })
          }
        />
      ) : null}

      {dialog?.kind === 'delete' ? (
        <DeleteUserDialog
          open
          onOpenChange={close}
          user={dialog.user}
          pending={remove.isPending}
          onConfirm={() => remove.mutate(dialog.user.id, { onSuccess: close })}
        />
      ) : null}
    </div>
  );
}
