import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/lib/env';
import { firstOfMonth, monthKey, startOfDay, todayInTz } from '@/lib/dates';
import { feeInfo } from '@/lib/status';
import { buildCheckinResult } from '@/lib/checkin-result';
import { signPhoto } from '@/lib/data';
import type { CheckinMethod, CheckinResult, Gym, Member, Plan } from '@/lib/types';

/** A second scan within this window shows "already checked in" instead of counting twice. */
export const REPEAT_WINDOW_MS = 3 * 60 * 60 * 1000;

export class CheckinError extends Error {
  constructor(public code: 'member_not_found' | 'archived') {
    super(code);
  }
}

export async function loadMemberWithPlan(admin: SupabaseClient, gymId: string, memberId: string) {
  const { data: member } = await admin.from('members').select('*').eq('gym_id', gymId).eq('id', memberId).maybeSingle();
  if (!member) return null;
  const m = member as Member;
  let plan: Plan | null = null;
  if (m.plan_id) {
    const { data } = await admin.from('plans').select('*').eq('id', m.plan_id).maybeSingle();
    plan = (data as Plan | null) ?? null;
  }
  return { member: m, plan };
}

export async function visitsThisMonth(admin: SupabaseClient, gym: Gym, memberId: string): Promise<number> {
  const since = startOfDay(firstOfMonth(monthKey(todayInTz(gym.timezone))), gym.timezone).toISOString();
  const { count } = await admin.from('checkins').select('id', { count: 'exact', head: true }).eq('member_id', memberId).gte('checked_at', since);
  return count ?? 0;
}

/**
 * Records a check-in (unless the member already checked in recently) and
 * returns what the kiosk and phone should show. Uses the service-role client:
 * callers must have already proven which gym this is.
 */
export async function performCheckin(
  admin: SupabaseClient,
  opts: { gym: Gym; memberId: string; kioskId: string | null; method: CheckinMethod; at?: Date; clientId?: string },
): Promise<CheckinResult> {
  const { gym } = opts;
  const loaded = await loadMemberWithPlan(admin, gym.id, opts.memberId);
  if (!loaded) throw new CheckinError('member_not_found');
  const { member, plan } = loaded;
  if (member.archived_at) throw new CheckinError('archived');

  const at = opts.at ?? new Date();
  const today = todayInTz(gym.timezone, at);
  const fee = feeInfo(member.valid_till, today);

  // One transaction with the member row locked, so simultaneous scans cannot both count.
  const { data, error } = await admin.rpc('record_checkin', {
    p_gym: gym.id,
    p_member: member.id,
    p_kiosk: opts.kioskId,
    p_method: opts.method,
    p_fee_status: fee.status,
    p_at: at.toISOString(),
    p_client_id: opts.clientId ?? null,
    p_repeat_secs: REPEAT_WINDOW_MS / 1000,
  });
  if (error) {
    if (error.message.includes('member_not_found')) throw new CheckinError('member_not_found');
    throw error;
  }
  const row = (Array.isArray(data) ? data[0] : data) as { checkin_id: string; checkin_at: string; is_repeat: boolean };
  const checkinId = row.checkin_id;
  // Postgres may return "2026-10-15 06:42:00+00"; normalise to ISO for the clients.
  const checkedAt = new Date(row.checkin_at).toISOString();
  const repeat = row.is_repeat;

  const [visits, photoUrl] = await Promise.all([visitsThisMonth(admin, gym, member.id), signPhoto(member.photo_path, 6 * 60 * 60)]);

  return buildCheckinResult({
    checkinId,
    member: {
      id: member.id,
      no: member.member_no,
      name: member.name,
      photoUrl,
      validTill: member.valid_till,
      planName: plan?.name ?? null,
      planPrice: plan?.price ?? null,
      planDays: plan?.duration_days ?? null,
    },
    visitsThisMonth: visits,
    method: opts.method,
    at: checkedAt,
    today,
    repeat,
  });
}

export function kioskTopic(channelKey: string): string {
  return `gg-kiosk-${channelKey}`;
}

/** Pushes a check-in to the kiosk screen through Supabase Realtime (broadcast). */
export async function broadcastToKiosk(channelKey: string, result: CheckinResult): Promise<void> {
  const e = env();
  try {
    await fetch(`${e.NEXT_PUBLIC_SUPABASE_URL}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: e.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ messages: [{ topic: kioskTopic(channelKey), event: 'checkin', payload: result, private: false }] }),
      signal: AbortSignal.timeout(2500),
    });
  } catch (err) {
    // The kiosk also polls, so a failed push only delays the screen a little.
    console.warn('[gymgate] realtime broadcast failed', err);
  }
}

/** Rebuilds the result card for a check-in row that already exists (used by kiosk polling). */
export async function resultForExisting(
  admin: SupabaseClient,
  gym: Gym,
  row: { id: string; member_id: string; method: CheckinMethod; checked_at: string },
): Promise<CheckinResult | null> {
  const loaded = await loadMemberWithPlan(admin, gym.id, row.member_id);
  if (!loaded) return null;
  const { member, plan } = loaded;
  const [visits, photoUrl] = await Promise.all([visitsThisMonth(admin, gym, member.id), signPhoto(member.photo_path, 6 * 60 * 60)]);
  return buildCheckinResult({
    checkinId: row.id,
    member: {
      id: member.id,
      no: member.member_no,
      name: member.name,
      photoUrl,
      validTill: member.valid_till,
      planName: plan?.name ?? null,
      planPrice: plan?.price ?? null,
      planDays: plan?.duration_days ?? null,
    },
    visitsThisMonth: visits,
    method: row.method,
    at: row.checked_at,
    today: todayInTz(gym.timezone, new Date(row.checked_at)),
  });
}
