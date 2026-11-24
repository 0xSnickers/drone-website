import { useTranslation } from 'react-i18next';
import { StoreSupportView } from '@/features/store';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function StorePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.store'));

  return <StoreSupportView />;
}
