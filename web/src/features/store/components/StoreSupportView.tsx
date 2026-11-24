import {
  ArrowRight,
  ChevronRight,
  Headset,
  Loader2,
  ShieldCheck,
  ShieldPlus,
  ShoppingCart,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AeroLogo, HardwareArt } from '@/components/ui/aero-logo';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { cn } from '@/core/utils/cn';
import { officialAccessories, storeCategories } from '../data/storeCatalog';
import { useCartStore } from '../store/cartStore';
import type { StoreCategoryId } from '../types';

export function StoreSupportView() {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<StoreCategoryId>('all');
  const [supportOpen, setSupportOpen] = useState(false);
  const [snInput, setSnInput] = useState('');
  const [snVerifying, setSnVerifying] = useState(false);
  const [snVerified, setSnVerified] = useState(false);
  const [snError, setSnError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);

  const items = useCartStore((state) => state.items);
  const addItem = useCartStore((state) => state.addItem);
  const showToast = useCartStore((state) => state.showToast);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const visibleAccessories =
    activeCategory === 'all'
      ? officialAccessories.slice(0, 3)
      : activeCategory === 'care'
        ? []
        : officialAccessories.filter((item) => item.category === activeCategory);

  const handleCategoryChange = (categoryId: StoreCategoryId, label: string) => {
    setActiveCategory(categoryId);
    showToast(t('store.categories.switchedToast', { label }));
  };

  const handleAddAccessory = (id: string, title: string, price: number) => {
    addItem({ id, title, price }, t('cart.addedToast', { title }));
  };

  const handleVerifySn = () => {
    if (snVerifying) return;
    if (snInput.trim().length < 6) {
      setSnVerified(false);
      setSnError(t('store.support.snInvalidError'));
      return;
    }
    setSnError(null);
    setSnVerifying(true);
    window.setTimeout(() => {
      setSnVerifying(false);
      setSnVerified(true);
      showToast(t('feedback.snVerifiedToast'));
    }, 400);
  };

  const handleDockCheckout = () => {
    if (checkingOut || totalCount === 0) return;
    setCheckingOut(true);
    window.setTimeout(() => {
      setCheckingOut(false);
      showToast(t('cart.checkoutToast', { count: totalCount }));
    }, 450);
  };

  return (
    <div className="flex flex-col pb-4">
      {/* Category Nav Pills */}
      <section className="w-full border-b border-border/50 bg-surface-lowest/60 px-5 py-2.5 backdrop-blur-md">
        <div className="no-scrollbar flex items-center gap-2 overflow-x-auto py-1">
          {storeCategories.map((cat) => {
            const label = t(cat.labelKey);
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => handleCategoryChange(cat.id, label)}
                className={cn(
                  'shrink-0 rounded-full px-4 py-1.5 text-xs font-semibold tracking-wide transition-all',
                  active
                    ? 'bg-primary text-primary-foreground glow-primary-sm'
                    : 'bg-card text-muted-foreground hover:bg-surface-high hover:text-foreground',
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Promotion Banner / Micro Campaign */}
      <section className="mt-4 px-5">
        <div className="relative overflow-hidden rounded-xl border border-border/60 bg-gradient-to-r from-surface-high via-card to-surface-low p-4 shadow-md">
          <div className="relative z-10 flex items-center justify-between gap-4">
            <div className="flex max-w-[72%] flex-col gap-1">
              <div className="inline-flex w-max items-center gap-1.5 rounded-full bg-secondary/20 px-2.5 py-0.5 text-secondary">
                <span className="size-1.5 animate-pulse rounded-full bg-secondary" />
                <span className="font-mono text-[10px] font-semibold tracking-wider uppercase">
                  {t('store.promo.badge')}
                </span>
              </div>
              <p className="mt-1 font-display text-lg font-semibold text-foreground">
                {t('store.promo.title')}
              </p>
              <p className="text-xs text-muted-foreground">{t('store.promo.desc')}</p>
            </div>
            <div className="flex flex-col items-end">
              <span className="font-display text-2xl font-bold tracking-tight text-primary">
                {t('store.promo.discount')}
              </span>
              <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
                {t('store.promo.autoApply')}
              </span>
            </div>
          </div>
          <div className="pointer-events-none absolute -right-8 -bottom-8 size-32 rounded-full bg-primary/10 blur-2xl" />
        </div>
      </section>

      {/* Popular Official Accessories */}
      {visibleAccessories.length > 0 ? (
        <section className="mt-6 flex flex-col gap-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-4 w-1.5 rounded-full bg-primary" />
              <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
                {t('store.accessories.title')}
              </h2>
            </div>
            <span className="font-mono text-[10px] font-semibold tracking-wider text-muted-foreground">
              {t('store.accessories.coreGear', { count: visibleAccessories.length })}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {visibleAccessories.map((item) => {
              const title = t(item.titleKey);
              return (
                <article
                  key={item.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card p-4 shadow-md transition-colors hover:bg-surface-high/70"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="relative flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-lowest p-2">
                      <HardwareArt variant={item.art} />
                      <span
                        className={cn(
                          'absolute top-1 left-1 rounded bg-surface-high/90 px-1.5 py-0.5 font-mono text-[10px] font-semibold',
                          item.id === 'charging-hub-100w'
                            ? 'text-muted-foreground'
                            : 'text-primary',
                        )}
                      >
                        {t(item.chipKey)}
                      </span>
                    </div>

                    <div className="flex min-w-0 flex-col">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-display text-base font-semibold text-foreground">
                          {title}
                        </h3>
                        {item.promoKey ? (
                          <span
                            className={cn(
                              'shrink-0 font-mono text-[10px] font-semibold',
                              item.promoTone === 'secondary' ? 'text-secondary' : 'text-primary',
                            )}
                          >
                            {t(item.promoKey)}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                        {t(item.descKey)}
                      </p>
                      <div className="mt-1.5 flex items-baseline gap-1.5">
                        <span className="font-display text-2xl font-bold tracking-tight text-primary">
                          ¥{item.price.toLocaleString()}
                        </span>
                        {item.originalPrice ? (
                          <span className="text-xs text-muted-foreground line-through">
                            ¥{item.originalPrice.toLocaleString()}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddAccessory(item.id, title, item.price)}
                    className="ml-2 flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground transition-transform active:scale-95 glow-primary-sm"
                  >
                    <ShoppingCart className="size-4" />
                    <span>{t('store.accessories.addBtn')}</span>
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* AeroCare Protection Plan Section */}
      <section className="mt-8 px-5">
        <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-surface-high p-4 shadow-xl">
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-secondary/5" />
          <div className="relative z-10 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-6 shrink-0 text-primary" />
                <h3 className="font-display text-lg font-semibold text-foreground">
                  {t('store.care.title')}
                </h3>
              </div>
              <span className="shrink-0 rounded bg-primary/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-primary">
                {t('store.care.badge')}
              </span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">{t('store.care.desc')}</p>
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-primary">¥699</span>
                <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                  {t('store.care.planUnit')}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleAddAccessory('aerocare-1y', t('store.care.cartTitle'), 699)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground transition-transform active:scale-95 glow-primary-sm"
              >
                <ShieldPlus className="size-4" />
                <span>{t('store.care.addPlanBtn')}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Official Support & Pilot Care Module */}
      <section className="mt-8 flex flex-col gap-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-4 w-1.5 rounded-full bg-primary" />
            <h2 className="font-display text-xl font-semibold tracking-tight text-foreground">
              {t('store.support.title')}
            </h2>
          </div>
          <span className="font-mono text-[10px] font-semibold text-primary">
            {t('store.support.onlineBadge')}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSupportOpen(true)}
          className="flex w-full items-center justify-between rounded-xl border border-border/50 bg-card p-4 text-left shadow-md transition-colors hover:bg-surface-high"
        >
          <div className="flex items-center gap-4">
            <div className="flex size-12 shrink-0 items-center justify-center rounded-lg bg-surface-high text-primary">
              <Headset className="size-6" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-semibold text-foreground">
                  {t('store.support.expertTitle')}
                </h4>
                <span className="size-2 animate-pulse rounded-full bg-primary" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{t('store.support.expertDesc')}</p>
            </div>
          </div>
          <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
        </button>
      </section>

      {/* Sticky Quick Checkout / Shopping Cart Float Dock */}
      <div className="sticky bottom-20 z-40 mx-5 mt-8 md:bottom-4">
        <div className="flex items-center justify-between rounded-full border border-border/70 bg-surface-highest/95 p-3 px-4 shadow-xl backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <div className="relative flex size-10 items-center justify-center rounded-full bg-card text-primary">
              <ShoppingCart className="size-5" />
              <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-secondary font-mono text-[10px] font-bold text-secondary-foreground">
                {totalCount}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                {t('cart.estimatedTotal')}
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-2xl font-bold text-primary">
                  ¥{totalPrice.toLocaleString()}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">
                  {t('cart.freeShipping')}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={checkingOut || totalCount === 0}
            onClick={handleDockCheckout}
            className="flex items-center gap-1.5 rounded-full bg-primary px-5 py-2.5 font-display text-base font-semibold text-primary-foreground transition-transform active:scale-95 disabled:opacity-60 glow-primary"
          >
            {checkingOut ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                <span>{t('cart.checkingOut')}</span>
              </>
            ) : (
              <>
                <span>{t('cart.checkoutNow')}</span>
                <ArrowRight className="size-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Support & SN Warranty Dialog */}
      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="border-border bg-card sm:max-w-md">
          <DialogHeader>
            <div className="mb-1 flex items-center gap-2">
              <AeroLogo className="size-6" />
              <DialogTitle className="font-display text-lg">
                {t('store.support.modalTitle')}
              </DialogTitle>
            </div>
            <DialogDescription>{t('store.support.modalDesc')}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <FormField label={t('store.support.snLabel')} error={snError ?? undefined}>
              <Input
                value={snInput}
                onChange={(e) => setSnInput(e.target.value)}
                placeholder={t('store.support.snPlaceholder')}
              />
            </FormField>
            {snVerified ? (
              <div className="rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs font-medium text-primary">
                {t('store.support.snValidResult')}
              </div>
            ) : null}
            <Button
              type="button"
              disabled={snVerifying}
              onClick={handleVerifySn}
              className="w-full"
            >
              {snVerifying ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>{t('feedback.verifyingSn')}</span>
                </>
              ) : (
                t('store.support.snVerifyBtn')
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
