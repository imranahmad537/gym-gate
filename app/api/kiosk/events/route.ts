import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { getKioskSession } from '@/lib/kiosk-auth';
import { resultForExisting } from '@/lib/checkin';
import type { CheckinMethod } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** Fallback for when Realtime is not connected: recent phone check-ins at this kiosk. */
export async function GET(request: NextRequest) {
  const session = await getKioskSession();
  if (!session) return NextResponse.json({ error: 'not_paired' }, { status: 401 });
  const afterParam = Date.parse(request.nextUrl.searchParams.get('after') ?? '');
  const floor = Date.now() - 2 * 60_000;
  const after = new Date(Number.isNaN(afterParam) ? floor : Math.max(afterParam, floor)).toISOString();

  const admin = createAdminClient();
  const { data } = await admin
    .from('checkins')
    .select('id, member_id, method, checked_at')
    .eq('kiosk_id', session.kiosk.id)
    .eq('method', 'phone')
    .gt('checked_at', after)
    .order('checked_at')
    .limit(10);
  const rows = (data ?? []) as { id: string; member_id: string; method: CheckinMethod; checked_at: string }[];
  const results = (await Promise.all(rows.map((r) => resultForExisting(admin, session.gym, r)))).filter(Boolean);
  return NextResponse.json({ results, serverTime: Date.now() }, { headers: { 'Cache-Control': 'private, no-store' } });
}
