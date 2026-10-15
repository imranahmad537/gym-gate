import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { firstOfMonth, monthKey, startOfDay, todayInTz } from '@/lib/dates';
import { signPhotos } from '@/lib/data';
import type { Gym, Kiosk, KioskMember, Member, Plan } from '@/lib/types';

export interface KioskState {
  kiosk: { id: string; name: string; secret: string; channel: string };
  gym: { name: string; tz: string; qrIntervalSecs: number; resultSecs: number; keypadEnabled: boolean };
  serverTime: number;
  members: KioskMember[];
}

/** Everything the tablet needs to run, including offline keypad check-ins. */
export async function buildKioskState(admin: SupabaseClient, gym: Gym, kiosk: Kiosk): Promise<KioskState> {
  const members: Member[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin
      .from('members')
      .select('*')
      .eq('gym_id', gym.id)
      .is('archived_at', null)
      .order('member_no')
      .range(from, from + 999);
    if (error) throw error;
    members.push(...((data ?? []) as Member[]));
    if (!data || data.length < 1000) break;
  }
  const since = startOfDay(firstOfMonth(monthKey(todayInTz(gym.timezone))), gym.timezone).toISOString();
  const [plansRes, visitsRes, photos] = await Promise.all([
    admin.from('plans').select('*').eq('gym_id', gym.id),
    admin.rpc('visit_counts', { p_gym: gym.id, p_since: since }),
    signPhotos(
      members.map((x) => x.photo_path),
      24 * 60 * 60,
    ),
  ]);
  const plans = new Map(((plansRes.data ?? []) as Plan[]).map((p) => [p.id, p]));
  const visits = new Map(((visitsRes.data ?? []) as { member_id: string; visits: number }[]).map((r) => [r.member_id, Number(r.visits)]));

  return {
    kiosk: { id: kiosk.id, name: kiosk.name, secret: kiosk.secret, channel: kiosk.channel_key },
    gym: {
      name: gym.name,
      tz: gym.timezone,
      qrIntervalSecs: gym.qr_interval_secs,
      resultSecs: gym.result_secs,
      keypadEnabled: gym.keypad_enabled,
    },
    serverTime: Date.now(),
    members: members.map((x) => {
      const plan = x.plan_id ? plans.get(x.plan_id) : undefined;
      return {
        id: x.id,
        no: x.member_no,
        name: x.name,
        last4: x.phone_last4,
        photoUrl: x.photo_path ? (photos.get(x.photo_path) ?? null) : null,
        validTill: x.valid_till,
        planName: plan?.name ?? null,
        planPrice: plan?.price ?? null,
        planDays: plan?.duration_days ?? null,
        visits: visits.get(x.id) ?? 0,
      };
    }),
  };
}
