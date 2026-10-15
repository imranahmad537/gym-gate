import { m } from '@/messages';
import { formatDate } from '@/lib/dates';
import { formatRs } from '@/lib/money';
import { waNumber } from '@/lib/phone';

export function waLink(phoneE164: string, text: string): string {
  return `https://wa.me/${waNumber(phoneE164)}?text=${encodeURIComponent(text)}`;
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/** Polite fee reminder. Uses the "ends on" wording when the plan has not ended yet. */
export function reminderLink(opts: {
  phone: string;
  name: string;
  gymName: string;
  planName: string | null;
  amount: number | null;
  validTill: string | null;
  today: string;
}): string {
  const plan = opts.planName ?? 'membership';
  const amount = formatRs(opts.amount ?? 0);
  const date = formatDate(opts.validTill ?? opts.today);
  const text =
    opts.validTill && opts.validTill >= opts.today
      ? m.whatsapp.reminderDue(firstName(opts.name), opts.gymName, plan, amount, date)
      : m.whatsapp.reminder(firstName(opts.name), opts.gymName, plan, amount, date);
  return waLink(opts.phone, text);
}
