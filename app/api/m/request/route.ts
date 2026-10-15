import { NextResponse, type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createAdminClient } from '@/lib/supabase/server';
import { lookupDevice } from '@/lib/device-auth';
import { normalizeActivationCode, randomSecret, sha256 } from '@/lib/crypto';
import { DEVICE_COOKIE, secureCookie } from '@/lib/cookies';
import { deviceLabel } from '@/lib/device-label';

/** "Ask to use this phone": creates a pending request the owner approves on Member Detail. */
export async function POST(request: NextRequest) {
  // `?? {}` also covers a literal `null` body, which parses fine but has no properties.
  const body = ((await request.json().catch(() => null)) ?? {}) as { code?: unknown };
  const admin = createAdminClient();
  const device = await lookupDevice();

  let memberId: string | null = null;
  let gymId: string | null = null;
  let secretHash: string | null = null;
  let newSecret: string | null = null;

  if (device.state === 'revoked') {
    memberId = device.device.member_id;
    gymId = device.device.gym_id;
    secretHash = device.secretHash;
  } else if (typeof body.code === 'string' && body.code.length <= 40) {
    const { data: act } = await admin
      .from('activations')
      .select('member_id, gym_id, expires_at')
      .eq('code_hash', sha256(normalizeActivationCode(body.code)))
      .maybeSingle();
    if (!act) return NextResponse.json({ status: 'invalid' }, { status: 404 });
    // An old link (e.g. a forwarded WhatsApp message) must not keep sending requests forever.
    if (Date.parse(act.expires_at) < Date.now()) return NextResponse.json({ status: 'expired' }, { status: 410 });
    memberId = act.member_id;
    gymId = act.gym_id;
    if (device.state === 'active' && device.device.member_id === memberId) return NextResponse.json({ status: 'already' });
    if (device.state === 'unknown') secretHash = device.secretHash;
    else {
      newSecret = randomSecret();
      secretHash = sha256(newSecret);
    }
  } else {
    return NextResponse.json({ status: 'invalid' }, { status: 400 });
  }

  const { data: member } = await admin.from('members').select('id, archived_at').eq('id', memberId).single();
  if (!member || member.archived_at) return NextResponse.json({ status: 'invalid' }, { status: 404 });

  await admin.from('device_requests').update({ status: 'declined', decided_at: new Date().toISOString() }).eq('member_id', memberId).eq('status', 'pending');
  const { error } = await admin.from('device_requests').insert({
    gym_id: gymId,
    member_id: memberId,
    secret_hash: secretHash,
    label: deviceLabel(request.headers.get('user-agent')),
  });
  if (error) return NextResponse.json({ status: 'error' }, { status: 500 });

  if (newSecret) (await cookies()).set(DEVICE_COOKIE, newSecret, secureCookie);
  return NextResponse.json({ status: 'sent' });
}
