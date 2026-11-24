import type { ComponentProps } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/core/utils/cn';

const badgeVariants = cva(
  'inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap [&_svg]:size-3',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-muted text-foreground',
        outline: 'text-muted-foreground',
        success: 'border-success/30 bg-success/10 text-success',
        warning: 'border-warning/30 bg-warning/10 text-warning',
        critical: 'border-critical/30 bg-critical/10 text-critical',
        primary: 'border-primary/30 bg-primary/10 text-primary',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants, type BadgeProps };
