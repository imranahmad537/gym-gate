import { after, NextResponse, type NextRequest } from 'next/server';
import { verifyAuthenticationResponse, verifyRegistrationResponse } from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { createAdminClient } from '@/lib/supabase/server';
import { lookupDevice } from '@/lib/device-auth';
import { verifyTicket } from '@/lib/ticket';
import { rp, type PasskeyTicket } from '@/lib/passkeys';
import { broadcastToKiosk, CheckinError, performCheckin } from '@/lib/checkin';
import type { Gym, Kiosk } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Second step when the gym requires fingerprint/face: verify the passkey, then check in. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { ticket?: string; response?: unknown } | null;
  const ticket = body?.ticket ? verifyTicket<PasskeyTicket>(body.ticket) : null;
  if (!ticket || !body?.response) return NextResponse.json({ status: 'expired' });

  const device = await lookupDevice();
  if (device.state !== 'active' || device.device.id !== ticket.d) return NextResponse.json({ status: 'unregistered' });

  const admin = createAdminClient();
  const { data: kiosk } = await admin.from('kiosks').select('*').eq('id', ticket.k).is('revoked_at', null).maybeSingle();
  if (!kiosk) return NextResponse.json({ status: 'invalid' });
  const { data: gymRow } = await admin.from('gyms').select('*').eq('id', kiosk.gym_id).single();
  const gym = gymRow as Gym;
  const k2 = kiosk as Kiosk;
  const gymInfo = { name: gym.name, tz: gym.timezone, kiosk: k2.name };
  const { origin, rpID } = await rp();

  try {
    if (ticket.mode === 'register') {
      const response = body.response as RegistrationResponseJSON;
      const v = await verifyRegistrationResponse({
        response,
        expectedChallenge: ticket.c,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
      });
      if (!v.verified) return NextResponse.json({ status: 'passkey_failed', gym: gymInfo });
      const cred = v.registrationInfo.credential;
      const { error } = await admin.from('passkeys').insert({
        device_id: device.device.id,
        credential_id: cred.id,
        public_key: Buffer.from(cred.publicKey).toString('base64url'),
        counter: cred.counter,
        transports: response.response.transports ?? [],
      });
      // Not fatal: the fingerprint was verified, the phone just registers again next time.
      if (error) console.warn('[gymgate] could not save passkey', error);
    } else {
      const response = body.response as AuthenticationResponseJSON;
      const { data: stored } = await admin.from('passkeys').select('*').eq('credential_id', response.id).eq('device_id', device.device.id).maybeSingle();
      if (!stored) return NextResponse.json({ status: 'passkey_failed', gym: gymInfo });
      const v = await verifyAuthenticationResponse({
        response,
        expectedChallenge: ticket.c,
        expectedOrigin: origin,
        expectedRPID: rpID,
        requireUserVerification: true,
        credential: {
          id: stored.credential_id,
          publicKey: new Uint8Array(Buffer.from(stored.public_key, 'base64url')),
          counter: Number(stored.counter),
          transports: stored.transports,
        },
      });
      if (!v.verified) return NextResponse.json({ status: 'passkey_failed', gym: gymInfo });
      await admin.from('passkeys').update({ counter: v.authenticationInfo.newCounter }).eq('id', stored.id);
    }
  } catch (err) {
    console.warn('[gymgate] passkey verification failed', err);
    return NextResponse.json({ status: 'passkey_failed', gym: gymInfo });
  }

  try {
    const result = await performCheckin(admin, { gym, memberId: device.device.member_id, kioskId: k2.id, method: 'phone' });
    after(() => broadcastToKiosk(k2.channel_key, result));
    return NextResponse.json({ status: 'ok', result, gym: gymInfo });
  } catch (err) {
    // Member archived or removed between the QR scan and the fingerprint step.
    if (err instanceof CheckinError) return NextResponse.json({ status: 'archived', gym: gymInfo });
    throw err;
  }
}
