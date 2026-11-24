import { ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';
import { Button } from '@/components/ui/button';
import { useIsAdmin } from '@/features/auth';
import { useRangeParams } from '@/features/filters';
import { IpProfile } from '@/features/ips';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function IpDetailPage() {
  const { t } = useTranslation();
  const { ip = '' } = useParams();
  useDocumentTitle(ip);
  const params = useRangeParams();
  const isAdmin = useIsAdmin();
  return (
    <div className="space-y-4">
      <Button asChild variant="ghost" size="sm">
        <Link to="/ips">
          <ArrowLeft />
          {t('ui.back')}
        </Link>
      </Button>
      <IpProfile ip={ip} params={params} canEdit={isAdmin} />
    </div>
  );
}
