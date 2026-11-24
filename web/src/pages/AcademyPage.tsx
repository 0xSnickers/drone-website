import { useTranslation } from 'react-i18next';
import { AcademyView } from '@/features/academy';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function AcademyPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.academy'));

  return <AcademyView />;
}
