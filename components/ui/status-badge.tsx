import { m } from '@/messages';
import type { FeeInfo } from '@/lib/status';

export const STATUS_STYLE = {
  active: 'text-ok bg-ok-soft',
  due: 'text-warn bg-warn-soft',
  overdue: 'text-bad bg-bad-soft',
  none: 'text-bad bg-bad-soft',
} as const;

export const STATUS_DOT = {
  active: 'bg-dot-ok',
  due: 'bg-dot-warn',
  overdue: 'bg-dot-bad',
  none: 'bg-dot-bad',
} as const;

export function statusLabel(info: FeeInfo): string {
  switch (info.status) {
    case 'active':
      return m.status.active;
    case 'due':
      return m.status.due(info.daysLeft ?? 0);
    case 'overdue':
      return m.status.overdue(info.overdueDays ?? 0);
    default:
      return m.status.none;
  }
}

export function StatusBadge({ info, className = '' }: { info: FeeInfo; className?: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-extrabold whitespace-nowrap ${STATUS_STYLE[info.status]} ${className}`}>
      {statusLabel(info)}
    </span>
  );
}
