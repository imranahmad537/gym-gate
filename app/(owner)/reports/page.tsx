import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/page-header';
import { getMembers, requireGym } from '@/lib/data';
import { firstOfMonth, formatDate, formatMonth, isMonthKey, lastOfMonth, monthKey, shiftMonth, startOfDay } from '@/lib/dates';
import { formatRs } from '@/lib/money';
import { owes } from '@/lib/status';
import { paymentsForMonth } from '@/lib/reports';
import { PAYMENT_METHODS } from '@/lib/types';
import { m } from '@/messages';

export const metadata: Metadata = { title: m.reports.title };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { supabase, gym, today } = await requireGym();
  const current = monthKey(today);
  const sp = await searchParams;
  const month = isMonthKey(sp.month) && sp.month <= current ? sp.month : current;
  const tz = gym.timezone;

  const [payments, members, newRes, checkinsRes] = await Promise.all([
    paymentsForMonth(supabase, month),
    getMembers(),
    supabase.from('members').select('id', { count: 'exact', head: true }).gte('joined_on', firstOfMonth(month)).lte('joined_on', lastOfMonth(month)),
    supabase
      .from('checkins')
      .select('id', { count: 'exact', head: true })
      .gte('checked_at', startOfDay(firstOfMonth(month), tz).toISOString())
      .lt('checked_at', startOfDay(firstOfMonth(shiftMonth(month, 1)), tz).toISOString()),
  ]);

  const total = payments.reduce((s, p) => s + p.amount, 0);
  const byMethod = PAYMENT_METHODS.map((method) => {
    const rows = payments.filter((p) => p.method === method);
    return { method, amount: rows.reduce((s, p) => s + p.amount, 0), count: rows.length };
  });
  const maxMethod = Math.max(1, ...byMethod.map((x) => x.amount));
  const owing = members.filter((x) => owes(x.fee.status));
  const owingAmount = owing.reduce((s, x) => s + (x.plan?.price ?? 0), 0);
  const names = new Map(members.map((x) => [x.id, x.name]));
  const isCurrent = month === current;

  return (
    <Page narrow>
      <header className="flex items-center justify-between gap-3 pt-4 pb-1 md:pt-6">
        <h1 className="text-[26px] font-extrabold">{m.reports.title}</h1>
        <a
          href={`/api/reports/csv?month=${month}`}
          download
          className="border-line bg-surface text-primary-ink inline-flex min-h-12 items-center gap-1.5 rounded-[14px] border-[1.5px] px-3.5 text-[15px] font-extrabold"
        >
          <Download className="size-[18px]" aria-hidden />
          {m.reports.export}
        </a>
      </header>

      <nav aria-label="Month" className="border-line bg-surface mt-3 flex h-14 items-center justify-between rounded-2xl border px-1">
        <Link
          href={`/reports?month=${shiftMonth(month, -1)}`}
          aria-label={m.reports.prevMonth}
          className="hover:bg-surface-2 flex size-12 items-center justify-center rounded-xl"
        >
          <ChevronLeft className="size-[22px]" aria-hidden />
        </Link>
        <span className="text-lg font-extrabold">{formatMonth(month)}</span>
        {isCurrent ? (
          <span aria-hidden className="flex size-12 items-center justify-center opacity-30">
            <ChevronRight className="size-[22px]" />
          </span>
        ) : (
          <Link
            href={`/reports?month=${shiftMonth(month, 1)}`}
            aria-label={m.reports.nextMonth}
            className="hover:bg-surface-2 flex size-12 items-center justify-center rounded-xl"
          >
            <ChevronRight className="size-[22px]" aria-hidden />
          </Link>
        )}
      </nav>

      <section className="bg-primary mt-3.5 rounded-[20px] p-[18px] text-white">
        <div className="text-sm font-bold opacity-90">{m.reports.total}</div>
        <div className="mt-1 text-[38px] leading-tight font-extrabold">{formatRs(total)}</div>
        <div className="mt-1 text-sm font-semibold opacity-90">{m.reports.sub(payments.length)}</div>
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        <div className="border-line bg-surface rounded-[18px] border p-4">
          <div className="text-muted text-[13px] font-bold">{m.reports.newMembers}</div>
          <div className="mt-1 text-[30px] font-extrabold">{newRes.count ?? 0}</div>
        </div>
        <div className="border-line bg-surface rounded-[18px] border p-4">
          <div className="text-muted text-[13px] font-bold">{m.reports.checkins}</div>
          <div className="mt-1 text-[30px] font-extrabold">{checkinsRes.count ?? 0}</div>
        </div>
        <div className="bg-bad-soft text-bad col-span-2 rounded-[18px] p-4 md:col-span-1">
          <div className="text-[13px] font-bold">{m.reports.overdueAmount}</div>
          <div className="mt-1.5 text-2xl font-extrabold">{formatRs(owingAmount)}</div>
          <div className="text-xs font-bold">{m.reports.overdueNow(owing.length)}</div>
        </div>
      </section>

      <Card aria-labelledby="pm-h" className="mt-3 flex flex-col gap-3.5 p-4">
        <h2 id="pm-h" className="text-lg font-extrabold">
          {m.reports.byMethod}
        </h2>
        {byMethod.map((x) => (
          <div key={x.method}>
            <div className="flex justify-between text-[15px] font-bold">
              <span>{m.methods[x.method]}</span>
              <span>{formatRs(x.amount)}</span>
            </div>
            <div className="bg-surface-2 mt-1.5 h-3 overflow-hidden rounded-md">
              <div className="bg-primary h-full rounded-md" style={{ width: `${Math.round((x.amount / maxMethod) * 100)}%` }} />
            </div>
            <div className="text-muted mt-1 text-xs font-semibold">
              {m.reports.methodLine(total ? `${Math.round((x.amount / total) * 100)}%` : '0%', x.count)}
            </div>
          </div>
        ))}
      </Card>

      <Card aria-labelledby="rp-h" className="mt-3 mb-4 overflow-hidden">
        <h2 id="rp-h" className="px-4 pt-4 pb-2 text-lg font-extrabold">
          {m.reports.latest}
        </h2>
        {payments.length === 0 && <p className="border-line text-muted border-t px-4 py-5 text-[15px] font-semibold">{m.reports.none}</p>}
        {payments.slice(0, 100).map((p) => (
          <Link key={p.id} href={`/members/${p.member_id}`} className="border-line hover:bg-surface-2 flex items-center gap-3 border-t px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold">{names.get(p.member_id) ?? '—'}</div>
              <div className="text-muted text-[13px] font-semibold">
                {formatDate(p.paid_on)} · {m.methods[p.method]}
              </div>
            </div>
            <div className="text-base font-extrabold">{formatRs(p.amount)}</div>
          </Link>
        ))}
      </Card>
    </Page>
  );
}
