import type { ComponentProps } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/core/utils/cn';

/** 原生 select（无障碍、移动端体验好），样式与 Input 一致。 */
function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <div className={cn('relative inline-flex', className)}>
      <select
        data-slot="select"
        className="h-9 w-full appearance-none rounded-md border border-input bg-background py-1 pr-8 pl-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

export { Select };
