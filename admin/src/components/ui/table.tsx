import type { ComponentProps } from 'react';
import { cn } from '@/core/utils/cn';

/** 表格外层可横向滚动，窄屏不撑破页面。 */
function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        data-slot="table"
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </div>
  );
}

const TableHeader = ({ className, ...props }: ComponentProps<'thead'>) => (
  <thead className={cn('[&_tr]:border-b', className)} {...props} />
);
const TableBody = ({ className, ...props }: ComponentProps<'tbody'>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);
const TableRow = ({ className, ...props }: ComponentProps<'tr'>) => (
  <tr className={cn('border-b transition-colors hover:bg-muted/50', className)} {...props} />
);
const TableHead = ({ className, ...props }: ComponentProps<'th'>) => (
  <th
    className={cn(
      'h-9 px-3 text-left align-middle text-xs font-medium whitespace-nowrap text-muted-foreground',
      className,
    )}
    {...props}
  />
);
const TableCell = ({ className, ...props }: ComponentProps<'td'>) => (
  <td className={cn('px-3 py-2 align-middle', className)} {...props} />
);

export { Table, TableBody, TableCell, TableHead, TableHeader, TableRow };
