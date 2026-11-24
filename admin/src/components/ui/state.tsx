import type { ReactNode } from 'react';
import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { cn } from '@/core/utils/cn';

/** 统一的加载 / 空 / 错误占位。 */
function StateMessage({
  kind,
  children,
  className,
}: {
  kind: 'loading' | 'empty' | 'error';
  children?: ReactNode;
  className?: string;
}) {
  const Icon = kind === 'loading' ? Loader2 : kind === 'error' ? AlertCircle : Inbox;
  return (
    <div
      role={kind === 'error' ? 'alert' : undefined}
      className={cn(
        'flex min-h-24 items-center justify-center gap-2 px-4 py-6 text-center text-sm text-muted-foreground',
        kind === 'error' && 'text-destructive',
        className,
      )}
    >
      <Icon className={cn('size-4 shrink-0', kind === 'loading' && 'animate-spin')} aria-hidden />
      {children}
    </div>
  );
}

export { StateMessage };
