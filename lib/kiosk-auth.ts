import 'server-only';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { sha256 } from '@/lib/crypto';
import { KIOSK_COOKIE } from '@/lib/cookies';
import type { Gym, Kiosk } from '@/lib/types';

export type KioskSession = { kiosk: Kiosk & { pin_failures: number; locked_until: string | null }; gym: Gym };

/** The kiosk this tablet is paired as, from its httpOnly cookie. */
export async function getKioskSession(): Promise<KioskSession | null> {
  const secret = (await cookies()).get(KIOSK_COOKIE)?.value;
  if (!secret) return null;
  const admin = createAdminClient();
  const { data: kiosk } = await admin.from('kiosks').select('*').eq('session_hash', sha256(secret)).is('revoked_at', null).maybeSingle();
  if (!kiosk) return null;
  const { data: gym } = await admin.from('gyms').select('*').eq('id', kiosk.gym_id).single();
  if (!gym) return null;
  return { kiosk, gym } as KioskSession;
}
