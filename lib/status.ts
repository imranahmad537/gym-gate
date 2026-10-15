import { diffDays } from '@/lib/dates';

export type FeeStatus = 'active' | 'due' | 'overdue' | 'none';

/** A plan counts as "due soon" when it ends within this many days. */
export const DUE_WINDOW_DAYS = 5;

export interface FeeInfo {
  status: FeeStatus;
  /** Days of cover left, counting today (0 = last day). Null when overdue/none. */
  daysLeft: number | null;
  /** Days since the plan ended. Null unless overdue. */
  overdueDays: number | null;
}

/** valid_till is inclusive: a member whose plan ends today can still train today. */
export function feeInfo(validTill: string | null | undefined, today: string): FeeInfo {
  if (!validTill) return { status: 'none', daysLeft: null, overdueDays: null };
  const left = diffDays(validTill, today);
  if (left < 0) return { status: 'overdue', daysLeft: null, overdueDays: -left };
  if (left <= DUE_WINDOW_DAYS) return { status: 'due', daysLeft: left, overdueDays: null };
  return { status: 'active', daysLeft: left, overdueDays: null };
}

/** Members who may train today without paying first. */
export function isValid(status: FeeStatus): boolean {
  return status === 'active' || status === 'due';
}

/** Members who owe money: overdue, or added without any payment. */
export function owes(status: FeeStatus): boolean {
  return status === 'overdue' || status === 'none';
}

const RANK: Record<FeeStatus, number> = { overdue: 0, none: 1, due: 2, active: 3 };

/** Sort so the people who need attention come first. */
export function compareByUrgency(a: FeeInfo, b: FeeInfo): number {
  if (RANK[a.status] !== RANK[b.status]) return RANK[a.status] - RANK[b.status];
  if (a.status === 'overdue') return (b.overdueDays ?? 0) - (a.overdueDays ?? 0);
  if (a.status === 'due' || a.status === 'active') return (a.daysLeft ?? 0) - (b.daysLeft ?? 0);
  return 0;
}
