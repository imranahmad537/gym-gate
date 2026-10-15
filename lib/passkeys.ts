import 'server-only';
import { generateAuthenticationOptions, generateRegistrationOptions } from '@simplewebauthn/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { appOrigin } from '@/lib/origin';
import { signTicket } from '@/lib/ticket';

export type PasskeyTicket = { d: string; k: string; c: string; mode: 'register' | 'auth' };

export async function rp() {
  const origin = await appOrigin();
  return { origin, rpID: new URL(origin).hostname };
}

/** Starts the "confirm with fingerprint" step for a phone that passed the QR check. */
export async function beginPasskey(admin: SupabaseClient, opts: { deviceId: string; kioskId: string; gymName: string; memberName: string }) {
  const { rpID } = await rp();
  const { data } = await admin.from('passkeys').select('credential_id, transports').eq('device_id', opts.deviceId);
  const creds = (data ?? []) as { credential_id: string; transports: string[] }[];
  if (creds.length === 0) {
    const options = await generateRegistrationOptions({
      rpName: opts.gymName,
      rpID,
      userName: opts.memberName,
      userID: new TextEncoder().encode(opts.deviceId),
      attestationType: 'none',
      authenticatorSelection: { residentKey: 'discouraged', userVerification: 'required', authenticatorAttachment: 'platform' },
      timeout: 60_000,
    });
    const ticket = signTicket<PasskeyTicket>({ d: opts.deviceId, k: opts.kioskId, c: options.challenge, mode: 'register' }, 180);
    return { mode: 'register' as const, options, ticket };
  }
  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials: creds.map((c) => ({ id: c.credential_id, transports: c.transports })),
    userVerification: 'required',
    timeout: 60_000,
  });
  const ticket = signTicket<PasskeyTicket>({ d: opts.deviceId, k: opts.kioskId, c: options.challenge, mode: 'auth' }, 180);
  return { mode: 'auth' as const, options, ticket };
}
