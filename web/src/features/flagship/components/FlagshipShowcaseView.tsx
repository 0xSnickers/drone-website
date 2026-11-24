import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/features/store';
import type { EditionId } from '../types';
import { FlagshipSpecsSection } from './FlagshipSpecsSection';
import { FlagshipStageSection } from './FlagshipStageSection';

export function FlagshipShowcaseView() {
  const { t } = useTranslation();
  const [edition, setEdition] = useState<EditionId>('combo');
  const showToast = useCartStore((state) => state.showToast);

  const handleSelectEdition = (next: EditionId) => {
    setEdition(next);
    const name =
      next === 'combo' ? t('flagship.editions.comboName') : t('flagship.editions.standardName');
    const price = next === 'combo' ? '8,999' : '6,999';
    showToast(t('flagship.editions.selectedToast', { name, price }));
  };

  return (
    <div className="flex flex-col">
      <FlagshipStageSection edition={edition} onSelectEdition={handleSelectEdition} />
      <FlagshipSpecsSection edition={edition} onSelectEdition={handleSelectEdition} />
    </div>
  );
}
