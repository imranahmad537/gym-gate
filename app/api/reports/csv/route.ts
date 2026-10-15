import { NextResponse, type NextRequest } from 'next/server';
import { getOwner, getPlans } from '@/lib/data';
import { formatDate, isMonthKey, monthKey, todayInTz } from '@/lib/dates';
import { displayPhone } from '@/lib/phone';
import { paymentsForMonth, toCsv } from '@/lib/reports';
import { m } from '@/messages';
import type { Member } from '@/lib/types';

export async function GET(request: NextRequest) {
  const owner = await getOwner();
  if (!owner?.gym) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { supabase, gym } = owner;
  const param = request.nextUrl.searchParams.get('month');
  const month = isMonthKey(param) ? param : monthKey(todayInTz(gym.timezone));

  const payments = await paymentsForMonth(supabase, month);
  const ids = [...new Set(payments.map((p) => p.member_id))];
  const members = new Map<string, Member>();
  for (let i = 0; i < ids.length; i += 200) {
    const { data } = await supabase
      .from('members')
      .select('*')
      .in('id', ids.slice(i, i + 200));
    for (const row of (data ?? []) as Member[]) members.set(row.id, row);
  }
  const plans = new Map((await getPlans()).map((p) => [p.id, p.name]));

  const rows = [
    m.reports.csvHeaders,
    ...payments.map((p) => {
      const mem = members.get(p.member_id);
      return [
        formatDate(p.paid_on),
        mem?.member_no ?? '',
        mem?.name ?? '',
        mem ? displayPhone(mem.phone) : '',
        p.plan_id ? (plans.get(p.plan_id) ?? '') : '',
        m.methods[p.method],
        p.amount,
        p.period_start ? formatDate(p.period_start) : '',
        p.period_end ? formatDate(p.period_end) : '',
        p.note ?? '',
      ];
    }),
  ];

  const slug =
    gym.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'gym';
  return new NextResponse(toCsv(rows), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-payments-${month}.csv"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
