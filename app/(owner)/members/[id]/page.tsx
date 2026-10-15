import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { CircleCheck, Clock, MessageCircle, Pencil, Phone, TriangleAlert } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import { ButtonAnchor } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Page } from '@/components/page-header';
import { getPlans, requireGym, signPhoto } from '@/lib/data';
import { daysInMonth, firstOfMonth, formatDate, formatMonth, formatTime, dateInTz, monthKey, startOfDay, weekdayIndexMon0 } from '@/lib/dates';
import { formatRs } from '@/lib/money';
import { displayPhone } from '@/lib/phone';
import { feeInfo } from '@/lib/status';
import { firstName, reminderLink } from '@/lib/whatsapp';
import { m } from '@/messages';
import type { Device, DeviceRequest, Member, Payment } from '@/lib/types';
import { PaymentButtons } from './payment-sheet';
import { PhoneAccessCard } from './phone-access';
import { ArchiveButton, PaymentHistory } from './history';

export const metadata: Metadata = { title: m.nav.members };

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, gym, today } = await requireGym();
  const tz = gym.timezone;
  const { data } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const member = data as Member;
  const month = monthKey(today);

  const [plans, paymentsRes, deviceRes, requestRes, visitsRes, photoUrl] = await Promise.all([
    getPlans(),
    supabase.from('payments').select('*').eq('member_id', id).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(50),
    supabase.from('devices').select('*').eq('member_id', id).is('revoked_at', null).order('activated_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('device_requests').select('*').eq('member_id', id).eq('status', 'pending').maybeSingle(),
    supabase
      .from('checkins')
      .select('checked_at')
      .eq('member_id', id)
      .gte('checked_at', startOfDay(firstOfMonth(month), tz).toISOString()),
    signPhoto(member.photo_path),
  ]);

  const plan = plans.find((p) => p.id === member.plan_id) ?? null;
  const fee = feeInfo(member.valid_till, today);
  const payments = (paymentsRes.data ?? []) as Payment[];
  const device = deviceRes.data as Device | null;
  const request = requestRes.data as DeviceRequest | null;
  const first = firstName(member.name);
  const archived = Boolean(member.archived_at);

  const visitDays = new Set(((visitsRes.data ?? []) as { checked_at: string }[]).map((r) => dateInTz(r.checked_at, tz)));
  const lead = weekdayIndexMon0(firstOfMonth(month));
  const todayNum = Number(today.slice(8, 10));
  const cells = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: daysInMonth(month) }, (_, i) => {
      const day = i + 1;
      const date = `${month}-${String(day).padStart(2, '0')}`;
      return { day, came: visitDays.has(date), future: day > todayNum || date < member.joined_on, today: day === todayNum };
    }),
  ];

  const tone =
    fee.status === 'active'
      ? { box: 'bg-ok-soft text-ok', icon: CircleCheck, head: `${m.status.active} · ${m.member.daysLeft(fee.daysLeft ?? 0)}` }
      : fee.status === 'due'
        ? { box: 'bg-warn-soft text-warn', icon: Clock, head: fee.daysLeft === 0 ? m.member.lastDay : m.status.due(fee.daysLeft ?? 0) }
        : fee.status === 'overdue'
          ? { box: 'bg-bad-soft text-bad', icon: TriangleAlert, head: m.status.overdueLong(fee.overdueDays ?? 0) }
          : { box: 'bg-bad-soft text-bad', icon: TriangleAlert, head: m.status.none };
  const ToneIcon = tone.icon;
  const activePlans = plans.filter((p) => p.is_active || p.id === member.plan_id);

  return (
    <Page narrow>
      <header className="flex h-[60px] items-center justify-between md:pt-4">
        <Link href="/members" className="text-primary-ink -ml-2 inline-flex min-h-12 items-center px-2 text-base font-bold">
          ‹ {m.nav.members}
        </Link>
        <Link href={`/members/${id}/edit`} aria-label={m.common.edit} className="hover:bg-surface-2 flex size-12 items-center justify-center rounded-[14px]">
          <Pencil className="size-5" aria-hidden />
        </Link>
      </header>

      {archived && <p className="bg-surface-2 text-muted mb-3 rounded-xl px-3.5 py-3 text-sm font-bold">{m.member.archivedBanner}</p>}

      <section className="flex items-center gap-4 pt-1">
        <Avatar name={member.name} seed={member.member_no} photoUrl={photoUrl} size="lg" />
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-extrabold">{member.name}</h1>
          <div className="text-muted mt-1 text-sm font-semibold">{m.member.idJoined(member.member_no, formatDate(member.joined_on))}</div>
          <a href={`tel:${member.phone}`} className="text-primary-ink inline-flex min-h-9 items-center gap-1.5 text-[15px] font-bold">
            <Phone className="size-4" aria-hidden />
            {displayPhone(member.phone)}
          </a>
        </div>
      </section>

      <section aria-label={m.form.plan} className={`mt-[18px] flex flex-col gap-2.5 rounded-[20px] p-[18px] ${tone.box}`}>
        <div className="flex items-center gap-2 text-[15px] font-extrabold">
          <ToneIcon className="size-5" aria-hidden />
          {tone.head}
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[13px] font-bold">
              {!plan
                ? m.member.noPlan
                : fee.status === 'overdue'
                  ? m.member.planEnded(plan.name)
                  : fee.status === 'none'
                    ? plan.name
                    : m.member.planValid(plan.name)}
            </div>
            <div className="text-2xl font-extrabold">{formatDate(member.valid_till)}</div>
          </div>
          {fee.status !== 'active' && plan && (
            <div className="text-right">
              <div className="text-[13px] font-bold">{m.member.amountDue}</div>
              <div className="text-2xl font-extrabold">{formatRs(plan.price)}</div>
            </div>
          )}
        </div>
      </section>

      {!archived && (
        <section aria-label="Actions" className="mt-3.5 grid grid-cols-2 gap-2.5">
          <PaymentButtons
            member={{ id: member.id, name: member.name, validTill: member.valid_till, planId: member.plan_id }}
            plans={activePlans}
            today={today}
          />
          <ButtonAnchor
            variant="soft"
            href={reminderLink({
              phone: member.phone,
              name: member.name,
              gymName: gym.name,
              planName: plan?.name ?? null,
              amount: plan?.price ?? null,
              validTill: member.valid_till,
              today,
            })}
            icon={<MessageCircle className="size-[18px]" aria-hidden />}
          >
            {m.member.feeReminder}
          </ButtonAnchor>
        </section>
      )}

      <div className="mt-5">
        <PhoneAccessCard
          member={{ id: member.id, firstName: first, last4: member.phone_last4, archived }}
          device={device ? { label: device.label ?? 'Phone', activatedOn: formatDate(dateInTz(device.activated_at, tz)) } : null}
          request={
            request
              ? {
                  id: request.id,
                  label: request.label ?? 'Phone',
                  when: `${formatDate(dateInTz(request.created_at, tz))} ${formatTime(request.created_at, tz)}`,
                }
              : null
          }
        />
      </div>

      <Card aria-labelledby="att-h" className="mt-5 p-4">
        <div className="flex items-baseline justify-between">
          <h2 id="att-h" className="text-lg font-extrabold">
            {m.member.visits(formatMonth(month).split(' ')[0])}
          </h2>
          <span className="text-primary-ink text-sm font-bold">{m.member.visitDays(visitDays.size)}</span>
        </div>
        <div className="mt-3.5 grid grid-cols-7 gap-1.5">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
            <div key={i} aria-hidden className="text-muted text-center text-xs font-bold">
              {d}
            </div>
          ))}
          {cells.map((c, i) =>
            c ? (
              <div
                key={i}
                aria-label={`${c.day} ${formatMonth(month)}${c.came ? `, ${m.member.came}` : ''}`}
                className={`flex h-[38px] items-center justify-center rounded-[10px] text-[13px] font-bold ${
                  c.future ? 'text-muted opacity-55' : c.came ? 'bg-primary text-white' : 'bg-surface-2 text-muted'
                } ${c.today ? 'ring-ink ring-2 ring-inset' : ''}`}
              >
                {c.day}
              </div>
            ) : (
              <div key={i} aria-hidden />
            ),
          )}
        </div>
        <div className="text-muted mt-3 flex gap-4 text-xs font-semibold">
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-primary size-3.5 rounded" />
            {m.member.came}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="bg-surface-2 size-3.5 rounded" />
            {m.member.missed}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="ring-ink size-3.5 rounded ring-2 ring-inset" />
            {m.member.today}
          </span>
        </div>
      </Card>

      <Card aria-labelledby="pay-h" className="mt-5 overflow-hidden">
        <h2 id="pay-h" className="px-4 pt-4 pb-2 text-lg font-extrabold">
          {m.member.payments}
        </h2>
        <PaymentHistory
          items={payments.map((p) => ({
            id: p.id,
            date: formatDate(p.paid_on),
            line: m.member.paymentRange(m.methods[p.method], p.extends_plan && p.period_end ? formatDate(p.period_end) : null),
            amount: formatRs(p.amount),
            note: p.note,
          }))}
        />
      </Card>

      <div className="flex justify-center py-6">
        <ArchiveButton memberId={member.id} firstName={first} archived={archived} />
      </div>
    </Page>
  );
}
