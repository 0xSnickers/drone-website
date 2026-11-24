import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './button';

interface PaginationProps {
  page: number;
  totalPages: number;
  onChange(page: number): void;
  labels: { prev: string; next: string; summary: string };
}

function Pagination({ page, totalPages, onChange, labels }: PaginationProps) {
  if (totalPages <= 1) return <p className="text-xs text-muted-foreground">{labels.summary}</p>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">{labels.summary}</p>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onChange(page - 1)}>
          <ChevronLeft />
          {labels.prev}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          {labels.next}
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

export { Pagination };
