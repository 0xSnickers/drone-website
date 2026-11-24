import { AlertTriangle, Bug, Info, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { LogLevel } from '../types';

const LEVELS = {
  debug: { variant: 'outline', icon: Bug },
  info: { variant: 'default', icon: Info },
  warn: { variant: 'warning', icon: AlertTriangle },
  error: { variant: 'critical', icon: XCircle },
} as const;

export function LevelBadge({ level }: { level: LogLevel }) {
  const { variant, icon: Icon } = LEVELS[level] ?? LEVELS.info;
  return (
    <Badge variant={variant} className="uppercase">
      <Icon aria-hidden />
      {level}
    </Badge>
  );
}
