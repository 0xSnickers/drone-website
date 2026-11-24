import { useTranslation } from 'react-i18next';
import { FlagshipShowcaseView } from '@/features/flagship';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function FlagshipPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.flagship'));

  return <FlagshipShowcaseView />;
}
