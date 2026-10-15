import type { FeeStatus } from '@/lib/status';

export type PaymentMethod = 'cash' | 'jazzcash' | 'easypaisa' | 'bank';
export type CheckinMethod = 'phone' | 'keypad' | 'manual';

export const PAYMENT_METHODS: PaymentMethod[] = ['cash', 'jazzcash', 'easypaisa', 'bank'];

export interface Gym {
  id: string;
  owner_id: string;
  name: string;
  phone: string | null;
  timezone: string;
  qr_interval_secs: 15 | 20 | 30;
  result_secs: number;
  keypad_enabled: boolean;
  require_passkey: boolean;
  one_device_per_member: boolean;
  kiosk_pin_hash: string | null;
  next_member_no: number;
  created_at: string;
}

export interface Plan {
  id: string;
  gym_id: string;
  name: string;
  duration_days: number;
  price: number;
  is_active: boolean;
  sort: number;
}

export interface Member {
  id: string;
  gym_id: string;
  member_no: number;
  name: string;
  phone: string;
  phone_last4: string;
  photo_path: string | null;
  plan_id: string | null;
  valid_till: string | null;
  joined_on: string;
  note: string | null;
  archived_at: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  gym_id: string;
  member_id: string;
  plan_id: string | null;
  amount: number;
  method: PaymentMethod;
  paid_on: string;
  extends_plan: boolean;
  period_start: string | null;
  period_end: string | null;
  note: string | null;
  created_at: string;
}

export interface Device {
  id: string;
  gym_id: string;
  member_id: string;
  label: string | null;
  activated_at: string;
  revoked_at: string | null;
  last_seen_at: string | null;
}

export interface DeviceRequest {
  id: string;
  gym_id: string;
  member_id: string;
  label: string | null;
  status: 'pending' | 'approved' | 'declined';
  created_at: string;
}

export interface Kiosk {
  id: string;
  gym_id: string;
  name: string;
  secret: string;
  channel_key: string;
  last_seen_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

export interface Checkin {
  id: string;
  gym_id: string;
  member_id: string;
  kiosk_id: string | null;
  method: CheckinMethod;
  fee_status: FeeStatus;
  checked_at: string;
}

/** What the kiosk and the member's phone show after a check-in. */
export interface CheckinResult {
  checkinId: string;
  memberId: string;
  memberNo: number;
  name: string;
  photoUrl: string | null;
  status: FeeStatus;
  planName: string | null;
  validTill: string | null;
  daysLeft: number | null;
  overdueDays: number | null;
  planDays: number | null;
  amountDue: number | null;
  visitsThisMonth: number;
  method: CheckinMethod;
  at: string;
  repeat: boolean;
}

/** Member row the kiosk keeps offline for keypad check-ins. */
export interface KioskMember {
  id: string;
  no: number;
  name: string;
  last4: string;
  photoUrl: string | null;
  validTill: string | null;
  planName: string | null;
  planPrice: number | null;
  planDays: number | null;
  visits: number;
}
