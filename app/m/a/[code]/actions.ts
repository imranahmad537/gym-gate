'use server';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizeActivationCode, randomSecret, sha256 } from '@/lib/crypto';
import { lookupDevice } from '@/lib/device-auth';
import { DEVICE_COOKIE, secureCookie } from '@/lib/cookies';
import { deviceLabel } from '@/lib/device-label';

/** Turns this phone into the member's gym pass using a one-time activation code. */
export async function activateAction(code: string): Promise<void> {
  const back = `/m/a/${encodeURIComponent(code)}`;
  const admin = createAdminClient();
  const { data: act } = await admin
    .from('activations')
    .select('id, gym_id, member_id, expires_at, used_at')
    .eq('code_hash', sha256(normalizeActivationCode(code)))
    .maybeSingle();
  if (!act || act.used_at || Date.parse(act.expires_at) < Date.now()) redirect(back);

  const [{ data: member }, { data: gym }] = await Promise.all([
    admin.from('members').select('id, archived_at').eq('id', act.member_id).single(),
    admin.from('gyms').select('one_device_per_member').eq('id', act.gym_id).single(),
  ]);
  if (!member || member.archived_at || !gym) redirect(back);

  // Already this member's pass: nothing to do, and the code stays unused.
  const existing = await lookupDevice();
  if (existing.state === 'active' && existing.device.member_id === member.id) redirect('/m');

  // Claim the code first so two taps (or two phones) cannot both use it.
  const { data: claimed } = await admin.from('activations').update({ used_at: new Date().toISOString() }).eq('id', act.id).is('used_at', null).select('id');
  if (!claimed || claimed.length === 0) redirect(back);

  const secret = randomSecret();
  const { data: device, error } = await admin
    .from('devices')
    .insert({ gym_id: act.gym_id, member_id: member.id, secret_hash: sha256(secret), label: deviceLabel((await headers()).get('user-agent')) })
    .select('id')
    .single();
  if (error || !device) {
    await admin.from('activations').update({ used_at: null }).eq('id', act.id);
    throw error ?? new Error('activation_failed');
  }
  // Only revoke the old phone once the new one exists, so a failed insert never leaves the member with no pass.
  if (gym.one_device_per_member) {
    await admin.from('devices').update({ revoked_at: new Date().toISOString() }).eq('member_id', member.id).is('revoked_at', null).neq('id', device.id);
  }
  await admin.from('activations').update({ used_device_id: device.id }).eq('id', act.id);
  await admin.from('device_requests').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('member_id', member.id).eq('status', 'pending');

  (await cookies()).set(DEVICE_COOKIE, secret, secureCookie);
  redirect('/m?activated=1');
}
