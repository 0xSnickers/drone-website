import { useState, type ReactNode } from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';

interface ChartCardProps {
  title: ReactNode;
  description?: ReactNode;
  chart: ReactNode;
  table: ReactNode;
  labels: { chart: string; table: string };
  actions?: ReactNode;
}

/** 图表卡片：标题 + 图表 / 表格切换。 */
export function ChartCard({ title, description, chart, table, labels, actions }: ChartCardProps) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const next = view === 'chart' ? 'table' : 'chart';
  return (
    <Card>
      <CardHeader
        title={title}
        description={description}
        actions={
          <>
            {actions}
            <Button
              variant="ghost"
              size="sm"
              aria-pressed={view === 'table'}
              onClick={() => setView(next)}
            >
              {view === 'chart' ? <Table2 /> : <BarChart3 />}
              {labels[next]}
            </Button>
          </>
        }
      />
      <CardContent>{view === 'chart' ? chart : table}</CardContent>
    </Card>
  );
}
