import { useTranslation } from 'react-i18next';
import {
  CoreInnovationsSection,
  GlobalGallerySection,
  HeroShowcaseSection,
} from '@/features/showcase';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

export function HomePage() {
  const { t } = useTranslation();
  useDocumentTitle(t('nav.home'));

  return (
    <div className="flex flex-col">
      <HeroShowcaseSection />
      <CoreInnovationsSection />
      <GlobalGallerySection />
    </div>
  );
}
