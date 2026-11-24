import { useTranslation } from 'react-i18next';
import { AcademyToolkitSection, CreatorFeedSection, SkyAwardSection } from '@/features/community';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function CommunityPage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.community'));

  return (
    <div className="flex flex-col">
      <SkyAwardSection />
      <CreatorFeedSection />
      <AcademyToolkitSection />
    </div>
  );
}
