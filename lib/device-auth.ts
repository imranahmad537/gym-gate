import 'server-only';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { sha256 } from '@/lib/crypto';
import { DEVICE_COOKIE } from '@/lib/cookies';
import type { Device } from '@/lib/types';

export type DeviceLookup = { state: 'none' } | { state: 'unknown'; secretHash: string } | { state: 'revoked' | 'active'; device: Device; secretHash: string };

/** Which member pass (if any) this phone holds. */
export async function lookupDevice(): Promise<DeviceLookup> {
  const secret = (await cookies()).get(DEVICE_COOKIE)?.value;
  if (!secret) return { state: 'none' };
  const secretHash = sha256(secret);
  const { data } = await createAdminClient().from('devices').select('*').eq('secret_hash', secretHash).maybeSingle();
  if (!data) return { state: 'unknown', secretHash };
  const device = data as Device;
  return { state: device.revoked_at ? 'revoked' : 'active', device, secretHash };
}
