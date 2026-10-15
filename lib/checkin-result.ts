import { feeInfo } from '@/lib/status';
import type { CheckinMethod, CheckinResult, KioskMember } from '@/lib/types';

/** Builds the result card from member data. Pure, so the kiosk can run it offline. */
export function buildCheckinResult(input: {
  checkinId: string;
  member: Pick<KioskMember, 'id' | 'no' | 'name' | 'photoUrl' | 'validTill' | 'planName' | 'planPrice' | 'planDays'>;
  visitsThisMonth: number;
  method: CheckinMethod;
  at: string;
  today: string;
  repeat?: boolean;
}): CheckinResult {
  const { member, today } = input;
  const info = feeInfo(member.validTill, today);
  const amountDue = info.status === 'active' ? null : member.planPrice;
  return {
    checkinId: input.checkinId,
    memberId: member.id,
    memberNo: member.no,
    name: member.name,
    photoUrl: member.photoUrl,
    status: info.status,
    planName: member.planName,
    validTill: member.validTill,
    daysLeft: info.daysLeft,
    overdueDays: info.overdueDays,
    planDays: member.planDays,
    amountDue,
    visitsThisMonth: input.visitsThisMonth,
    method: input.method,
    at: input.at,
    repeat: input.repeat ?? false,
  };
}
