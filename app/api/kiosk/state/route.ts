import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getKioskSession } from '@/lib/kiosk-auth';
import { buildKioskState } from '@/lib/kiosk-snapshot';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getKioskSession();
  if (!session) return NextResponse.json({ error: 'not_paired' }, { status: 401 });
  const admin = createAdminClient();
  const state = await buildKioskState(admin, session.gym, session.kiosk);
  await admin.from('kiosks').update({ last_seen_at: new Date().toISOString() }).eq('id', session.kiosk.id);
  return NextResponse.json(state, { headers: { 'Cache-Control': 'private, no-store' } });
}
