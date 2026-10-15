import { after, NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { verifyKioskToken } from '@/lib/kiosk-token';
import { lookupDevice } from '@/lib/device-auth';
import { broadcastToKiosk, CheckinError, performCheckin } from '@/lib/checkin';
import { beginPasskey } from '@/lib/passkeys';
import type { Gym, Kiosk } from '@/lib/types';

export const dynamic = 'force-dynamic';

const body = z.object({ k: z.uuid(), w: z.coerce.number().int(), t: z.string().max(64) });

/**
 * A member's phone scanned the kiosk QR. Checks the rotating token and the
 * phone's pass cookie, records the check-in and pushes it to the kiosk.
 * Always answers 200 with a `status` so the phone can show the right screen.
 */
export async function POST(request: NextRequest) {
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ status: 'invalid' });
  const { k, w, t } = parsed.data;
  const admin = createAdminClient();

  const { data: kiosk } = await admin.from('kiosks').select('*').eq('id', k).is('revoked_at', null).maybeSingle();
  if (!kiosk) return NextResponse.json({ status: 'invalid' });
  const { data: gymRow } = await admin.from('gyms').select('*').eq('id', kiosk.gym_id).single();
  const gym = gymRow as Gym;
  const k2 = kiosk as Kiosk;
  const gymInfo = { name: gym.name, tz: gym.timezone, kiosk: k2.name };

  const token = verifyKioskToken({ secret: k2.secret, kioskId: k2.id, window: w, token: t, intervalSecs: gym.qr_interval_secs });
  if (token !== 'ok') return NextResponse.json({ status: token, gym: gymInfo });

  const device = await lookupDevice();
  if (device.state === 'none' || device.state === 'unknown' || device.device.gym_id !== gym.id) {
    return NextResponse.json({ status: 'unregistered', gym: gymInfo });
  }
  if (device.state === 'revoked') {
    const { count } = await admin.from('devices').select('id', { count: 'exact', head: true }).eq('member_id', device.device.member_id).is('revoked_at', null);
    return NextResponse.json({ status: (count ?? 0) > 0 ? 'other_device' : 'unregistered', gym: gymInfo });
  }

  const { data: member } = await admin.from('members').select('id, name, archived_at').eq('id', device.device.member_id).single();
  if (!member || member.archived_at) return NextResponse.json({ status: 'archived', gym: gymInfo });

  if (gym.require_passkey) {
    const step = await beginPasskey(admin, { deviceId: device.device.id, kioskId: k2.id, gymName: gym.name, memberName: member.name });
    return NextResponse.json({ status: 'passkey', ...step, gym: gymInfo });
  }

  try {
    const result = await performCheckin(admin, { gym, memberId: member.id, kioskId: k2.id, method: 'phone' });
    after(async () => {
      await Promise.all([
        broadcastToKiosk(k2.channel_key, result),
        admin.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.device.id),
      ]);
    });
    return NextResponse.json({ status: 'ok', result, gym: gymInfo });
  } catch (err) {
    if (err instanceof CheckinError) return NextResponse.json({ status: 'archived', gym: gymInfo });
    throw err;
  }
}
