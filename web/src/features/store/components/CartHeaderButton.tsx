import { ArrowRight, Loader2, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useCartStore } from '../store/cartStore';

export function CartHeaderButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const items = useCartStore((state) => state.items);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const removeItem = useCartStore((state) => state.removeItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const showToast = useCartStore((state) => state.showToast);

  const totalCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  const handleRemove = (id: string, title: string) => {
    removeItem(id);
    showToast(t('cart.removedToast', { title }));
  };

  const handleClear = () => {
    clearCart();
    showToast(t('cart.clearedToast'));
  };

  const handleCheckout = () => {
    if (checkingOut || totalCount === 0) return;
    setCheckingOut(true);
    window.setTimeout(() => {
      setCheckingOut(false);
      setOpen(false);
      showToast(t('cart.checkoutToast', { count: totalCount }));
    }, 450);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t('cart.ariaLabel')}
          className="relative flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-high hover:text-primary"
        >
          <ShoppingBag className="size-5" />
          {totalCount > 0 ? (
            <span className="absolute top-1.5 right-1.5 flex min-w-4 items-center justify-center rounded-full bg-secondary px-1 font-mono text-[10px] font-bold text-secondary-foreground glow-secondary-sm">
              {totalCount}
            </span>
          ) : null}
        </button>
      </DialogTrigger>
      <DialogContent className="border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">{t('cart.title')}</DialogTitle>
          <DialogDescription>{t('cart.description')}</DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <div className="rounded-lg bg-surface-low p-6 text-center text-sm text-muted-foreground">
            {t('cart.empty')}
          </div>
        ) : (
          <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-surface-low p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{item.title}</p>
                  <p className="font-display text-sm font-bold text-primary">
                    ¥{item.price.toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="-"
                    onClick={() => updateQuantity(item.id, -1)}
                    className="flex size-7 items-center justify-center rounded bg-surface-high text-foreground hover:text-primary"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-6 text-center font-mono text-xs font-semibold">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="+"
                    onClick={() => updateQuantity(item.id, 1)}
                    className="flex size-7 items-center justify-center rounded bg-surface-high text-foreground hover:text-primary"
                  >
                    <Plus className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('cart.remove')}
                    onClick={() => handleRemove(item.id, item.title)}
                    className="ml-1 flex size-7 items-center justify-center rounded text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <span className="block font-mono text-[10px] tracking-wider text-muted-foreground uppercase">
              {t('cart.estimatedTotal')}
            </span>
            <div className="flex items-baseline gap-2">
              <span className="font-display text-2xl font-bold text-primary">
                ¥{totalPrice.toLocaleString()}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">
                {t('cart.freeShipping')}
              </span>
            </div>
          </div>
          {items.length > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={handleClear}>
              {t('cart.clear')}
            </Button>
          ) : null}
        </div>

        <DialogFooter>
          <Button
            type="button"
            disabled={items.length === 0 || checkingOut}
            onClick={handleCheckout}
            className="w-full font-display font-semibold glow-primary-sm"
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
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
