import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/core/utils/cn';

function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      data-slot="card"
      className={cn('min-w-0 rounded-lg border bg-card text-card-foreground', className)}
      {...props}
    />
  );
}

interface CardHeaderProps extends Omit<ComponentProps<'div'>, 'title'> {
  title: ReactNode;
  description?: ReactNode;
  /** 标题右侧的操作区（筛选、切换、链接）。 */
  actions?: ReactNode;
}

function CardHeader({ title, description, actions, className, ...props }: CardHeaderProps) {
  return (
    <div
      data-slot="card-header"
      className={cn('flex flex-wrap items-start justify-between gap-3 px-4 pt-4', className)}
      {...props}
    >
      <div className="min-w-0 space-y-1">
        <h2 className="text-sm font-semibold">{title}</h2>
        {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('p-4', className)} {...props} />;
}

export { Card, CardContent, CardHeader };
