import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getKioskSession } from '@/lib/kiosk-auth';
import { verifyPin } from '@/lib/crypto';

const MAX_TRIES = 5;
const LOCK_MS = 5 * 60_000;

/** Checks the owner PIN before leaving kiosk mode. Locks after repeated failures. */
export async function POST(request: NextRequest) {
  const session = await getKioskSession();
  if (!session) return NextResponse.json({ ok: true }); // already not a kiosk
  const { kiosk, gym } = session;
  if (kiosk.locked_until && Date.parse(kiosk.locked_until) > Date.now()) {
    return NextResponse.json({ ok: false, error: 'locked' }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = typeof body?.pin === 'string' && /^\d{4}$/.test(body.pin) ? body.pin : null;
  const admin = createAdminClient();

  if (pin && (await verifyPin(pin, gym.kiosk_pin_hash))) {
    await admin.from('kiosks').update({ pin_failures: 0, locked_until: null }).eq('id', kiosk.id);
    return NextResponse.json({ ok: true });
  }
  const failures = kiosk.pin_failures + 1;
  const locked = failures >= MAX_TRIES;
  await admin
    .from('kiosks')
    .update({ pin_failures: locked ? 0 : failures, locked_until: locked ? new Date(Date.now() + LOCK_MS).toISOString() : null })
    .eq('id', kiosk.id);
  return NextResponse.json({ ok: false, error: locked ? 'locked' : 'wrong' }, { status: locked ? 429 : 403 });
}
