import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';
import { getKioskSession } from '@/lib/kiosk-auth';
import { CheckinError, performCheckin } from '@/lib/checkin';

export const dynamic = 'force-dynamic';

const body = z.object({
  items: z
    .array(z.object({ clientId: z.uuid(), memberId: z.uuid(), at: z.iso.datetime({ offset: true }) }))
    .min(1)
    .max(200),
});

/** Keypad check-ins from the tablet, sent live or synced later after being offline. */
export async function POST(request: NextRequest) {
  const session = await getKioskSession();
  if (!session) return NextResponse.json({ error: 'not_paired' }, { status: 401 });
  const parsed = body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'bad_request' }, { status: 400 });

  const admin = createAdminClient();
  const now = Date.now();
  const results: { clientId: string; ok: boolean; visits?: number; error?: string }[] = [];
  for (const item of parsed.data.items) {
    // Accept up to 3 days of offline backlog; never trust future timestamps.
    const t = Math.min(now, Math.max(now - 3 * 86_400_000, Date.parse(item.at)));
    try {
      const r = await performCheckin(admin, {
        gym: session.gym,
        memberId: item.memberId,
        kioskId: session.kiosk.id,
        method: 'keypad',
        at: new Date(t),
        clientId: item.clientId,
      });
      results.push({ clientId: item.clientId, ok: true, visits: r.visitsThisMonth });
    } catch (err) {
      // Member removed meanwhile: drop the item so the queue does not get stuck.
      if (err instanceof CheckinError) results.push({ clientId: item.clientId, ok: true, error: err.code });
      else results.push({ clientId: item.clientId, ok: false, error: 'server_error' });
    }
  }
  await admin.from('kiosks').update({ last_seen_at: new Date().toISOString() }).eq('id', session.kiosk.id);
  return NextResponse.json({ results });
}
