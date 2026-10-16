import { CircleCheck, Clock, Dumbbell, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatDate, formatMonth, formatTime, monthKey, todayInTz } from '@/lib/dates';
import { formatRs } from '@/lib/money';
import { firstName } from '@/lib/whatsapp';
import type { CheckinResult } from '@/lib/types';
import { m } from '@/messages';

export function PhoneShell({ gymName, children }: { gymName?: string | null; children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="flex h-16 shrink-0 items-center gap-2.5 px-5">
        <span className="bg-primary flex size-9 items-center justify-center rounded-[11px] text-on-primary">
          <Dumbbell className="size-5" aria-hidden />
        </span>
        <span className="text-base font-extrabold">{gymName || m.app.name}</span>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

export function StatusScreen({
  icon,
  tone = 'neutral',
  title,
  body,
  children,
}: {
  icon: ReactNode;
  tone?: 'ok' | 'warn' | 'bad' | 'neutral';
  title: ReactNode;
  body?: ReactNode;
  children?: ReactNode;
}) {
  const toneCls = { ok: 'bg-ok-soft text-ok', warn: 'bg-warn-soft text-warn', bad: 'bg-bad-soft text-bad', neutral: 'bg-surface-2 text-muted' }[tone];
  return (
    <div className="flex flex-1 flex-col items-center gap-3.5 px-6 pt-10 pb-6 text-center">
      <span className={`flex size-28 items-center justify-center rounded-full ${toneCls}`}>{icon}</span>
      <h1 className="text-[26px] leading-tight font-extrabold">{title}</h1>
      {body && <p className="text-muted text-[17px] leading-relaxed">{body}</p>}
      <div className="flex-1" />
      <div className="flex w-full flex-col gap-3">{children}</div>
    </div>
  );
}

/** Big tick (or warning) the member sees on their phone after checking in. */
export function CheckinResultView({ result, tz, kioskName, compact }: { result: CheckinResult; tz: string; kioskName?: string; compact?: boolean }) {
  const valid = result.status === 'active' || result.status === 'due';
  const tone = result.status === 'active' ? 'bg-[#0b5d35] text-white' : result.status === 'due' ? 'bg-[#f2b33d] text-[#2a1a00]' : 'bg-[#9f1d1d] text-white';
  const iconTone = result.status === 'active' ? 'text-[#0b5d35]' : result.status === 'due' ? 'text-[#8a4b00]' : 'text-[#9f1d1d]';
  const Icon = result.status === 'active' ? CircleCheck : result.status === 'due' ? Clock : TriangleAlert;
  const time = formatTime(result.at, tz);
  const pct = result.daysLeft != null && result.planDays ? Math.max(0, Math.min(100, Math.round((Math.max(result.daysLeft, 0.5) / result.planDays) * 100))) : 0;

  return (
    <div className="flex flex-col gap-3 px-4 pb-6">
      {!compact && (
        <div className={`flex flex-col items-center gap-3 rounded-[28px] px-5 pt-8 pb-7 text-center ${tone}`}>
          <span className={`flex size-[108px] items-center justify-center rounded-full bg-white ${iconTone}`}>
            <Icon className="size-16" strokeWidth={2.6} aria-hidden />
          </span>
          <h1 className="text-[28px] leading-tight font-extrabold">
            {valid
              ? result.repeat
                ? m.phone.already(time)
                : m.phone.checkedIn(time)
              : result.status === 'overdue'
                ? m.phone.overdueTitle
                : m.phone.noPlanTitle}
          </h1>
          <div className="text-base font-semibold opacity-90">{kioskName ? m.phone.welcomeLine(firstName(result.name), kioskName) : result.name}</div>
        </div>
      )}

      <div className="border-line bg-surface flex flex-col gap-2.5 rounded-[22px] border p-[18px]">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-lg font-extrabold">{result.planName ? m.phone.plan(result.planName) : m.kiosk.noPlan}</span>
          {result.validTill && (
            <span className={`text-sm font-bold ${valid ? 'text-muted' : 'text-bad'}`}>
              {valid ? m.phone.validTill(formatDate(result.validTill)) : m.phone.endedOn(formatDate(result.validTill))}
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label={m.member.daysLeft(result.daysLeft ?? 0)}
          aria-valuemin={0}
          aria-valuemax={result.planDays ?? 0}
          aria-valuenow={result.daysLeft ?? 0}
          className={`h-3.5 overflow-hidden rounded-full ${valid ? 'bg-surface-2' : 'bg-bad-soft'}`}
        >
          <div className={`h-full rounded-full ${result.status === 'due' ? 'bg-dot-warn' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
        </div>
        {valid ? (
          <div className={`text-[15px] font-extrabold ${result.status === 'due' ? 'text-warn' : 'text-ok'}`}>
            {result.daysLeft === 0 ? m.phone.lastDay : m.phone.daysLeft(result.daysLeft ?? 0)}
          </div>
        ) : (
          <div className="text-bad flex justify-between text-[15px] font-extrabold">
            <span>{result.overdueDays ? m.phone.overdueDays(result.overdueDays) : m.status.none}</span>
            {result.amountDue != null && <span>{m.phone.due(formatRs(result.amountDue))}</span>}
          </div>
        )}
      </div>

      <div className="border-line bg-surface flex items-center justify-between rounded-[22px] border p-[18px]">
        <span className="text-base font-bold">{m.phone.visits(formatMonth(monthKey(todayInTz(tz, new Date(result.at)))).split(' ')[0])}</span>
        <span className="text-[30px] font-extrabold">{result.visitsThisMonth}</span>
      </div>
    </div>
  );
}
