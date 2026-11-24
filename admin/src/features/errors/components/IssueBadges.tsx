import { CheckCircle2, CircleDot, EyeOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import type { ErrorType, IssueStatus } from '../types';

const STATUS = {
  open: { variant: 'critical', icon: CircleDot },
  resolved: { variant: 'success', icon: CheckCircle2 },
  ignored: { variant: 'outline', icon: EyeOff },
} as const;

/** 状态徽标：颜色 + 图标 + 文字。 */
export function IssueStatusBadge({ status }: { status: IssueStatus }) {
  const { t } = useTranslation();
  const { variant, icon: Icon } = STATUS[status];
  return (
    <Badge variant={variant}>
      <Icon aria-hidden />
      {t(`errors.statuses.${status}`)}
    </Badge>
  );
}

export function ErrorTypeBadge({ type }: { type: ErrorType }) {
  const { t } = useTranslation();
  return <Badge variant="outline">{t(`errors.types.${type}`)}</Badge>;
}
