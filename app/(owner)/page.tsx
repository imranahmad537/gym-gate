import Link from 'next/link';
import { ChevronRight, Dumbbell, Grid3x3, MessageCircle, Plus, Smartphone, UserRound } from 'lucide-react';
import { Card, CardHeader, Row } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { ButtonLink } from '@/components/ui/button';
import { Dot } from '@/components/ui/misc';
import { STATUS_DOT } from '@/components/ui/status-badge';
import { Page } from '@/components/page-header';
import { getMembers, requireGym } from '@/lib/data';
import { addDays, firstOfMonth, formatLongDay, formatMonth, formatTime, lastOfMonth, monthKey, startOfDay, weekdayShort } from '@/lib/dates';
import { formatRs } from '@/lib/money';
import { compareByUrgency, isValid, owes, type FeeStatus } from '@/lib/status';
import { reminderLink } from '@/lib/whatsapp';
import { m } from '@/messages';
import type { CheckinMethod } from '@/lib/types';

export default async function DashboardPage() {
  const { supabase, gym, today } = await requireGym();
  const tz = gym.timezone;
  const month = monthKey(today);
  const weekStart = addDays(today, -6);

  const [members, todayRes, payRes, dailyRes, requestsRes] = await Promise.all([
    getMembers(),
    supabase
      .from('checkins')
      .select('id, member_id, method, fee_status, checked_at', { count: 'exact' })
      .gte('checked_at', startOfDay(today, tz).toISOString())
      .order('checked_at', { ascending: false })
      .limit(12),
    supabase.rpc('payment_summary', { p_gym: gym.id, p_from: firstOfMonth(month), p_to: lastOfMonth(month) }),
    supabase.rpc('daily_checkins', { p_gym: gym.id, p_since: startOfDay(weekStart, tz).toISOString(), p_tz: tz }),
    supabase.from('device_requests').select('id, member_id, created_at').eq('status', 'pending').order('created_at', { ascending: false }),
  ]);

  const byId = new Map(members.map((x) => [x.id, x]));
  const active = members.filter((x) => isValid(x.fee.status));
  const owing = members.filter((x) => owes(x.fee.status)).sort((a, b) => compareByUrgency(a.fee, b.fee));
  const owingAmount = owing.reduce((sum, x) => sum + (x.plan?.price ?? 0), 0);
  const payRows = (payRes.data ?? []) as { total: number; payments: number }[];
  const collected = payRows.reduce((s, r) => s + Number(r.total), 0);
  const paymentsCount = payRows.reduce((s, r) => s + Number(r.payments), 0);
  const feed = (todayRes.data ?? []) as { id: string; member_id: string; method: CheckinMethod; fee_status: FeeStatus; checked_at: string }[];
  const todayCount = todayRes.count ?? feed.length;
  const daily = new Map(((dailyRes.data ?? []) as { day: string; checkins: number }[]).map((r) => [r.day, Number(r.checkins)]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = addDays(weekStart, i);
    return { day, label: i === 6 ? m.dashboard.today : weekdayShort(day), value: daily.get(day) ?? 0 };
  });
  const weekMax = Math.max(1, ...week.map((d) => d.value));
  const weekTotal = week.reduce((s, d) => s + d.value, 0);
  const requests = (requestsRes.data ?? []) as { id: string; member_id: string }[];
  const shownOwing = owing.slice(0, 5);

  return (
    <Page>
      <header className="flex items-center justify-between gap-3 pt-4 pb-2 md:pt-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="bg-primary flex size-10 shrink-0 items-center justify-center rounded-xl text-white md:hidden">
            <Dumbbell className="size-[22px]" aria-hidden />
          </span>
          <div className="min-w-0">
            <h1 className="truncate text-[17px] leading-tight font-extrabold md:text-[26px]">
              <span className="md:hidden">{gym.name}</span>
              <span className="hidden md:inline">{m.nav.dashboard}</span>
            </h1>
            <div className="text-muted text-[13px] font-medium md:text-[15px]">{formatLongDay(today)}</div>
          </div>
        </div>
        <div className="hidden md:block">
          <ButtonLink href="/members/new" icon={<Plus className="size-5" aria-hidden />}>
            {m.dashboard.addMember}
          </ButtonLink>
        </div>
      </header>

      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-3 pt-2 lg:grid-cols-4">
        <div className="border-line bg-surface flex flex-col gap-1.5 rounded-[18px] border p-4">
          <div className="text-muted text-[13px] font-semibold">{m.dashboard.todayCheckins}</div>
          <div className="text-[34px] leading-none font-extrabold">{todayCount}</div>
          <div className="text-muted text-xs">{feed[0] ? m.dashboard.lastAt(formatTime(feed[0].checked_at, tz)) : m.dashboard.noneYet}</div>
        </div>
        <div className="border-line bg-surface flex flex-col gap-1.5 rounded-[18px] border p-4">
          <div className="text-muted text-[13px] font-semibold">{m.dashboard.active}</div>
          <div className="text-[34px] leading-none font-extrabold">{active.length}</div>
          <div className="text-muted text-xs">{m.dashboard.ofTotal(members.length)}</div>
        </div>
        <Link href="/members?filter=overdue" className="bg-bad-soft text-bad flex flex-col gap-1.5 rounded-[18px] p-4">
          <div className="text-[13px] font-bold">{m.dashboard.overdue}</div>
          <div className="text-[34px] leading-none font-extrabold">{owing.length}</div>
          <div className="text-xs font-semibold">{m.dashboard.pending(formatRs(owingAmount))}</div>
        </Link>
        <Link href="/reports" className="bg-primary flex flex-col gap-1.5 rounded-[18px] p-4 text-white">
          <div className="text-[13px] font-semibold opacity-90">{m.dashboard.collected(formatMonth(month).split(' ')[0].slice(0, 3))}</div>
          <div className="text-[26px] leading-tight font-extrabold">{formatRs(collected)}</div>
          <div className="text-xs opacity-90">{m.dashboard.payments(paymentsCount)}</div>
        </Link>
      </section>

      {requests.length > 0 && (
        <section
          aria-label={m.dashboard.deviceRequests(requests.length)}
          className="bg-warn-soft text-warn mt-4 flex items-center gap-3 rounded-[18px] py-3.5 pr-3.5 pl-4"
        >
          <span className="bg-surface flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Smartphone className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-extrabold">{m.dashboard.deviceRequests(requests.length)}</div>
            <div className="truncate text-[13px] font-semibold">{m.dashboard.deviceRequestLine(byId.get(requests[0].member_id)?.name ?? 'A member')}</div>
          </div>
          <Link
            href={`/members/${requests[0].member_id}`}
            className="bg-surface text-ink inline-flex min-h-11 items-center rounded-xl px-3.5 text-sm font-extrabold"
          >
            {m.dashboard.review}
          </Link>
        </section>
      )}

      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Card aria-labelledby="ov-h" className="overflow-hidden">
          <CardHeader
            id="ov-h"
            title={m.dashboard.overdueFees}
            action={
              owing.length > 0 && (
                <Link href="/members?filter=overdue" className="text-primary-ink inline-flex min-h-11 items-center gap-0.5 text-sm font-bold">
                  {m.common.seeAll(owing.length)}
                  <ChevronRight className="size-[18px]" aria-hidden />
                </Link>
              )
            }
          />
          {shownOwing.length === 0 && <p className="border-line text-muted border-t px-4 py-5 text-[15px] font-semibold">{m.dashboard.noOverdue}</p>}
          {shownOwing.map((x) => (
            <Row key={x.id}>
              <Link href={`/members/${x.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                <Avatar name={x.name} seed={x.member_no} photoUrl={x.photoUrl} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-bold">{x.name}</span>
                  <span className="text-bad block truncate text-[13px] font-bold">
                    {x.fee.status === 'overdue'
                      ? m.dashboard.overdueLine(x.fee.overdueDays ?? 0, formatRs(x.plan?.price))
                      : m.dashboard.noPaymentLine(formatRs(x.plan?.price))}
                  </span>
                </span>
              </Link>
              <a
                href={reminderLink({
                  phone: x.phone,
                  name: x.name,
                  gymName: gym.name,
                  planName: x.plan?.name ?? null,
                  amount: x.plan?.price ?? null,
                  validTill: x.valid_till,
                  today,
                })}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${m.dashboard.remind}: ${x.name}`}
                className="bg-primary-soft text-primary-ink inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl px-3 text-sm font-bold"
              >
                <MessageCircle className="size-[18px]" aria-hidden />
                {m.dashboard.remind}
              </a>
            </Row>
          ))}
          {owing.length > shownOwing.length && (
            <div className="border-line text-muted border-t px-4 py-3 text-[13px]">
              {m.dashboard.more(
                owing
                  .slice(shownOwing.length, shownOwing.length + 2)
                  .map((x) => x.name)
                  .join(', '),
                owing.length - shownOwing.length,
              )}
            </div>
          )}
        </Card>

        <Card aria-labelledby="ci-h" className="overflow-hidden">
          <CardHeader
            id="ci-h"
            title={m.dashboard.feed}
            action={<span className="text-muted text-[13px] font-semibold">{m.dashboard.soFar(todayCount)}</span>}
          />
          {feed.length === 0 && <p className="border-line text-muted border-t px-4 py-5 text-[15px] font-semibold">{m.dashboard.feedEmpty}</p>}
          {feed.map((c) => {
            const MethodIcon = c.method === 'phone' ? Smartphone : c.method === 'keypad' ? Grid3x3 : UserRound;
            return (
              <Row key={c.id}>
                <span className="text-muted w-[62px] shrink-0 text-[13px] font-bold">{formatTime(c.checked_at, tz)}</span>
                <Dot className={STATUS_DOT[c.fee_status]} />
                <Link href={`/members/${c.member_id}`} className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                  {byId.get(c.member_id)?.name ?? '—'}
                </Link>
                <span role="img" aria-label={m.checkinMethod[c.method]} title={m.checkinMethod[c.method]} className="text-muted flex shrink-0">
                  <MethodIcon className="size-[18px]" aria-hidden />
                </span>
              </Row>
            );
          })}
          {todayCount > feed.length && <div className="border-line text-muted border-t px-4 py-3 text-[13px]">+{todayCount - feed.length}</div>}
        </Card>

        <Card aria-labelledby="ch-h" className="p-4">
          <div className="flex items-baseline justify-between">
            <h2 id="ch-h" className="text-lg font-extrabold">
              {m.dashboard.last7}
            </h2>
            <span className="text-muted text-[13px] font-semibold">{m.dashboard.total(weekTotal)}</span>
          </div>
          <div role="img" aria-label={week.map((d) => `${d.label} ${d.value}`).join(', ')} className="mt-4 grid h-[170px] grid-cols-7 items-end gap-2.5">
            {week.map((d, i) => (
              <div key={d.day} className="flex h-full flex-col items-center justify-end gap-1.5">
                <div className="text-xs font-extrabold">{d.value}</div>
                <div
                  className={`w-full rounded-t-lg rounded-b-sm ${i === 6 ? 'bg-primary' : 'bg-bar'}`}
                  style={{ height: `${Math.max(4, Math.round((d.value / weekMax) * 112))}px` }}
                />
                <div className="text-muted text-xs font-bold">{d.label}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Link
        href="/members/new"
        className="bg-primary fixed right-4 bottom-[92px] z-30 inline-flex min-h-14 items-center gap-2 rounded-[18px] pr-5 pl-4 text-base font-extrabold text-white shadow-[0_8px_20px_rgba(11,93,53,0.35)] md:hidden"
      >
        <Plus className="size-[22px]" strokeWidth={2.4} aria-hidden />
        {m.dashboard.addMember}
      </Link>
    </Page>
  );
}
