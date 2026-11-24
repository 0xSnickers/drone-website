import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LineSeries } from './line-chart';

interface SeriesTableProps<K extends string> {
  data: ({ bucket: string } & Record<K, number>)[];
  series: LineSeries<K>[];
  timeLabel: string;
  formatX(bucket: string): string;
  formatValue(value: number): string;
}

/** 图表的表格视图：每个数值都能不依赖颜色和悬停读到。 */
export function SeriesTable<K extends string>({
  data,
  series,
  timeLabel,
  formatX,
  formatValue,
}: SeriesTableProps<K>) {
  return (
    <div className="max-h-64 overflow-y-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{timeLabel}</TableHead>
            {series.map((s) => (
              <TableHead key={s.key} className="text-right">
                {s.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...data].reverse().map((d) => (
            <TableRow key={d.bucket}>
              <TableCell className="text-muted-foreground tabular-nums">
                {formatX(d.bucket)}
              </TableCell>
              {series.map((s) => (
                <TableCell key={s.key} className="text-right tabular-nums">
                  {formatValue(d[s.key])}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
