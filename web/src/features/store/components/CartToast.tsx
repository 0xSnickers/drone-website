import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { useCartStore } from '../store/cartStore';

export function CartToast() {
  const toastMessage = useCartStore((state) => state.toastMessage);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-none fixed top-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-lg transition-all duration-300 glow-primary-sm',
        toastMessage ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
      )}
    >
      <CheckCircle2 className="size-4 shrink-0" />
      <span>{toastMessage ?? ''}</span>
    </div>
  );
}
