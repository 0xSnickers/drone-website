import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { useIsAdmin } from '@/features/auth';
import { IssueDetailView } from '@/features/errors';
import { useRangeParams } from '@/features/filters';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function ErrorDetailPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('errors.title'));
  const { id = '' } = useParams();
  const params = useRangeParams();
  const isAdmin = useIsAdmin();
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/errors">
          <ArrowLeft />
          {t('ui.back')}
        </Link>
      </Button>
      <IssueDetailView issueId={id} params={params} canEdit={isAdmin} />
    </div>
  );
}
