import {
  Aperture,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Loader2,
  Package,
  ShoppingCart,
  Sliders,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/core/utils/cn';
import { useCartStore } from '@/features/store';
import type { EditionId } from '../types';

interface FlagshipSpecsSectionProps {
  edition: EditionId;
  onSelectEdition: (edition: EditionId) => void;
}

export function FlagshipSpecsSection({ edition, onSelectEdition }: FlagshipSpecsSectionProps) {
  const { t } = useTranslation();
  const [ordering, setOrdering] = useState(false);
  const addItem = useCartStore((state) => state.addItem);
  const showToast = useCartStore((state) => state.showToast);

  const isCombo = edition === 'combo';
  const currentPrice = isCombo ? 8999 : 6999;
  const originalPrice = isCombo ? 9499 : 7299;
  const currentName = isCombo
    ? t('flagship.editions.comboName')
    : t('flagship.editions.standardFull');

  const comboChecklist = [
    { label: t('flagship.packages.comboItems.host'), accent: 'primary' as const },
    { label: t('flagship.packages.comboItems.rcPro'), accent: 'secondary' as const },
    { label: t('flagship.packages.comboItems.batteries'), accent: 'secondary' as const },
    { label: t('flagship.packages.comboItems.hub'), accent: 'primary' as const },
    { label: t('flagship.packages.comboItems.ndFilter'), accent: 'primary' as const },
    { label: t('flagship.packages.comboItems.bag'), accent: 'primary' as const },
  ];

  const standardChecklist = [
    t('flagship.packages.standardItems.host'),
    t('flagship.packages.standardItems.rcStd'),
    t('flagship.packages.standardItems.battery'),
    t('flagship.packages.standardItems.props'),
  ];

  const handleAddToCart = () => {
    addItem(
      {
        id: `v8-pro-${edition}`,
        title: `AeroApex V8 Pro · ${currentName}`,
        price: currentPrice,
      },
      t('flagship.editions.addedToast', { name: currentName }),
    );
  };

  const handleOrderNow = () => {
    if (ordering) return;
    setOrdering(true);
    addItem({
      id: `v8-pro-${edition}`,
      title: `AeroApex V8 Pro · ${currentName}`,
      price: currentPrice,
    });
    const nextCount = useCartStore.getState().items.reduce((sum, item) => sum + item.quantity, 0);
    window.setTimeout(() => {
      setOrdering(false);
      showToast(t('cart.checkoutToast', { count: nextCount }));
    }, 450);
  };

  return (
    <>
      {/* Dual Focal Optical Imaging System */}
      <section className="flex flex-col gap-4 bg-surface-low px-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="block font-mono text-[10px] font-semibold tracking-widest text-primary uppercase">
              {t('flagship.optics.eyebrow')}
            </span>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-foreground sm:text-2xl">
              {t('flagship.optics.title')}
            </h2>
          </div>
          <div className="rounded-lg bg-surface-high p-2 text-primary">
            <Aperture className="size-6" />
          </div>
        </div>

        <div className="flex flex-col gap-4 overflow-hidden rounded-xl border border-border/50 bg-surface-lowest p-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-card">
            <img
              src="/images/aeroapex/camera-exploded.jpg"
              alt={t('flagship.optics.title')}
              className="size-full object-cover"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface-lowest via-transparent to-transparent" />
            <div className="absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded bg-surface-lowest/85 px-2.5 py-1 backdrop-blur-sm">
              <Sliders className="size-3.5 text-secondary" />
              <span className="font-mono text-[10px] font-semibold text-foreground">
                {t('flagship.optics.stabilityBadge')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Wide Lens */}
            <div className="flex flex-col gap-2 rounded-lg bg-surface-high p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                    {t('flagship.optics.wideTag')}
                  </span>
                  <span className="font-display text-base font-semibold text-foreground">
                    {t('flagship.optics.wideFocal')}
                  </span>
                </div>
                <span className="font-mono text-[10px] font-semibold text-secondary">
                  {t('flagship.optics.wideSensor')}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('flagship.optics.wideDesc')}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {(['dlog', 'raw', 'denoise'] as const).map((tagKey) => (
                  <span
                    key={tagKey}
                    className="rounded bg-surface-highest px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {t(`flagship.optics.wideTags.${tagKey}`)}
                  </span>
                ))}
              </div>
            </div>

            {/* Tele Lens */}
            <div className="flex flex-col gap-2 rounded-lg bg-surface-high p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded bg-surface-highest px-2 py-0.5 font-mono text-[10px] font-semibold text-muted-foreground">
                    {t('flagship.optics.teleTag')}
                  </span>
                  <span className="font-display text-base font-semibold text-foreground">
                    {t('flagship.optics.teleFocal')}
                  </span>
                </div>
                <span className="font-mono text-[10px] font-semibold text-primary">
                  {t('flagship.optics.teleSensor')}
                </span>
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t('flagship.optics.teleDesc')}
              </p>
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {(['matrix', 'aperture', 'ois'] as const).map((tagKey) => (
                  <span
                    key={tagKey}
                    className="rounded bg-surface-highest px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                  >
                    {t(`flagship.optics.teleTags.${tagKey}`)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Flight Dynamics & Avionics */}
      <section className="flex flex-col gap-4 px-5 py-6">
        <div className="flex items-center justify-between">
          <div>
            <span className="block font-mono text-[10px] font-semibold tracking-widest text-secondary uppercase">
              {t('flagship.performance.eyebrow')}
            </span>
            <h2 className="mt-0.5 font-display text-xl font-semibold text-foreground sm:text-2xl">
              {t('flagship.performance.title')}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 animate-pulse rounded-full bg-primary" />
            <span className="font-mono text-[10px] font-semibold text-primary">
              {t('flagship.performance.badge')}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <div className="flex flex-col items-center justify-between rounded-xl border border-border/50 bg-card p-3 text-center">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('flagship.performance.speedLabel')}
            </span>
            <div className="my-2 flex items-baseline justify-center gap-0.5">
              <span className="font-display text-2xl font-bold text-foreground">24</span>
              <span className="font-mono text-[10px] text-muted-foreground">m/s</span>
            </div>
            <span className="font-mono text-[10px] text-primary">
              {t('flagship.performance.speedSub')}
            </span>
          </div>

          <div className="flex flex-col items-center justify-between rounded-xl bg-surface-high p-3 text-center ring-1 ring-primary/40">
            <span className="text-xs font-semibold text-primary">
              {t('flagship.performance.flightLabel')}
            </span>
            <div className="my-2 flex items-baseline justify-center gap-0.5">
              <span className="font-display text-2xl font-bold text-primary">46</span>
              <span className="font-mono text-[10px] font-semibold text-primary">MIN</span>
            </div>
            <span className="font-mono text-[10px] text-primary">
              {t('flagship.performance.flightSub')}
            </span>
          </div>

          <div className="flex flex-col items-center justify-between rounded-xl border border-border/50 bg-card p-3 text-center">
            <span className="text-xs font-semibold text-muted-foreground">
              {t('flagship.performance.windLabel')}
            </span>
            <div className="my-2 flex items-baseline justify-center gap-0.5">
              <span className="font-display text-2xl font-bold text-foreground">12</span>
              <span className="font-mono text-[10px] text-muted-foreground">m/s</span>
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">
              {t('flagship.performance.windSub')}
            </span>
          </div>
        </div>
      </section>

      {/* Package Configurations & In-The-Box Checklist */}
      <section className="flex flex-col gap-4 bg-surface-low px-5 py-6">
        <div>
          <span className="block font-mono text-[10px] font-semibold tracking-widest text-primary uppercase">
            {t('flagship.packages.eyebrow')}
          </span>
          <h2 className="mt-0.5 font-display text-xl font-semibold text-foreground sm:text-2xl">
            {t('flagship.packages.title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectEdition('combo')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectEdition('combo');
            }}
            className={cn(
              'cursor-pointer rounded-xl p-4 transition-all',
              isCombo
                ? 'border border-primary/40 bg-surface-high glow-primary-sm'
                : 'border border-border/50 bg-card opacity-85 hover:opacity-100',
            )}
          >
            <div className="flex items-center justify-between pb-2.5">
              <div className="flex items-center gap-2">
                <Award className="size-5 text-primary" />
                <div>
                  <h3 className="font-display text-lg font-semibold text-primary">
                    {t('flagship.editions.comboName')}
                  </h3>
                  <span className="font-mono text-[10px] font-semibold text-secondary">
                    {t('flagship.editions.comboSub')}
                  </span>
                </div>
              </div>
              <span className="font-display text-xl font-bold text-primary">¥8,999</span>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
              {comboChecklist.map((entry) => (
                <div
                  key={entry.label}
                  className="flex items-center gap-1.5 text-xs text-foreground"
                >
                  <CheckCircle2
                    className={cn(
                      'size-4 shrink-0',
                      entry.accent === 'secondary' ? 'text-secondary' : 'text-primary',
                    )}
                  />
                  <span>{entry.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelectEdition('standard')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelectEdition('standard');
            }}
            className={cn(
              'cursor-pointer rounded-xl p-4 transition-all',
              !isCombo
                ? 'border border-primary/40 bg-surface-high glow-primary-sm'
                : 'border border-border/50 bg-card opacity-85 hover:opacity-100',
            )}
          >
            <div className="flex items-center justify-between pb-2.5">
              <div className="flex items-center gap-2">
                <Package className="size-5 text-muted-foreground" />
                <div>
                  <h3 className="font-display text-lg font-semibold text-foreground">
                    {t('flagship.editions.standardFull')}
                  </h3>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {t('flagship.editions.standardSub')}
                  </span>
                </div>
              </div>
              <span className="font-display text-xl font-bold text-foreground">¥6,999</span>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-border/60 pt-3">
              {standardChecklist.map((label) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Check className="size-4 shrink-0" />
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Sticky Aerospace Order Dock */}
      <aside className="sticky bottom-16 z-40 flex items-center justify-between gap-4 border-t border-border/60 bg-surface-lowest/92 px-5 py-3 shadow-2xl backdrop-blur-xl md:bottom-0 md:rounded-b-xl">
        <div className="flex min-w-0 flex-col">
          <div className="flex items-center gap-1.5">
            <span
              className={cn(
                'font-mono text-[10px] font-semibold uppercase',
                isCombo ? 'text-secondary' : 'text-muted-foreground',
              )}
            >
              {currentName}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground line-through">
              ¥{originalPrice.toLocaleString()}
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-mono text-xs font-semibold text-primary">¥</span>
            <span className="font-display text-2xl font-bold text-primary">
              {currentPrice.toLocaleString()}
            </span>
            <span className="ml-1 font-mono text-[10px] text-muted-foreground">
              {t('flagship.dock.installment')}
            </span>
          </div>
        </div>

        <div className="flex max-w-56 flex-1 items-center gap-2">
          <button
            type="button"
            aria-label={t('flagship.dock.addCartAria')}
            onClick={handleAddToCart}
            className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-surface-high text-primary transition-colors hover:bg-surface-highest"
          >
            <ShoppingCart className="size-5" />
          </button>
          <button
            type="button"
            disabled={ordering}
            onClick={handleOrderNow}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-3 font-display text-sm font-bold text-primary-foreground transition-transform active:scale-95 disabled:opacity-70 glow-primary"
          >
            {ordering ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{t('cart.checkingOut')}</span>
              </>
            ) : (
              <>
                <span>{t('flagship.dock.buyNow')}</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
