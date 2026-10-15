'use client';
import { RefreshCw, Wallet } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input, Label, Toggle, inputClass } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { addDays, formatDate, isDateString } from '@/lib/dates';
import { formatRs, groupDigits, parseAmount } from '@/lib/money';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/types';
import { m } from '@/messages';
import { deletePaymentAction, recordPaymentAction } from '../../actions';

type PlanOption = { id: string; name: string; duration_days: number; price: number };

export function PaymentButtons({
  member,
  plans,
  today,
}: {
  member: { id: string; name: string; validTill: string | null; planId: string | null };
  plans: PlanOption[];
  today: string;
}) {
  const [mode, setMode] = useState<'pay' | 'renew' | null>(null);
  return (
    <>
      <Button size="lg" className="col-span-2" onClick={() => setMode('pay')} icon={<Wallet className="size-[22px]" aria-hidden />}>
        {m.member.recordPayment}
      </Button>
      <Button variant="secondary" onClick={() => setMode('renew')} icon={<RefreshCw className="size-[18px]" aria-hidden />}>
        {m.member.renew}
      </Button>
      {mode && <PaymentSheet key={mode} mode={mode} member={member} plans={plans} today={today} onClose={() => setMode(null)} />}
    </>
  );
}

function PaymentSheet({
  mode,
  member,
  plans,
  today,
  onClose,
}: {
  mode: 'pay' | 'renew';
  member: { id: string; name: string; validTill: string | null; planId: string | null };
  plans: PlanOption[];
  today: string;
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [planId, setPlanId] = useState(member.planId && plans.some((p) => p.id === member.planId) ? member.planId : (plans[0]?.id ?? ''));
  const plan = plans.find((p) => p.id === planId);
  const [amount, setAmount] = useState(plan ? groupDigits(plan.price) : '');
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [paidOn, setPaidOn] = useState(today);
  const [note, setNote] = useState('');
  const [extendChoice, setExtendChoice] = useState<boolean | null>(null);

  const n = parseAmount(amount) ?? 0;
  const extend = extendChoice ?? (plan ? n >= plan.price : false);
  const start = member.validTill && isDateString(paidOn) && member.validTill >= paidOn ? addDays(member.validTill, 1) : paidOn;
  const end = plan && isDateString(start) ? addDays(start, plan.duration_days - 1) : null;

  function changePlan(id: string) {
    setPlanId(id);
    const p = plans.find((x) => x.id === id);
    if (p) setAmount(groupDigits(p.price));
  }

  function save() {
    if (n <= 0) return;
    startTransition(async () => {
      const res = await recordPaymentAction({ memberId: member.id, amount: n, method, paidOn, extend, planId: planId || null, note });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      onClose();
      toast.show(m.payment.recorded(formatRs(n)), {
        action: {
          label: m.payment.undo,
          onClick: async () => {
            const undo = await deletePaymentAction(res.paymentId);
            if (undo.ok) toast.show(m.payment.undone);
            else toast.error(undo.error);
          },
        },
      });
    });
  }

  let preview: { kicker: string; big: string; small: string; cls: string };
  if (n <= 0)
    preview = {
      kicker: m.payment.enterAmount,
      big: 'Rs 0',
      small: plan ? m.payment.planIs(plan.name, formatRs(plan.price)) : '',
      cls: 'bg-surface-2 text-muted',
    };
  else if (extend && end && plan)
    preview = {
      kicker: m.payment.newValidTill,
      big: formatDate(end),
      small: m.payment.covers(formatDate(start), formatDate(end), plan.duration_days),
      cls: 'bg-ok-soft text-ok',
    };
  else
    preview = {
      kicker: m.payment.partTitle,
      big: plan && n < plan.price ? m.payment.partBig(formatRs(plan.price - n)) : formatRs(n),
      small: m.payment.partSmall,
      cls: 'bg-warn-soft text-warn',
    };

  return (
    <Sheet open onClose={onClose} title={mode === 'renew' ? m.payment.renewTitle : m.payment.title} subtitle={`${member.name}${plan ? ` · ${plan.name}` : ''}`}>
      {(mode === 'renew' || plans.length > 1) && (
        <fieldset>
          <legend className="text-muted mb-1.5 text-[13px] font-bold">{m.payment.plan}</legend>
          <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(plans.length, 3)}, minmax(0, 1fr))` }}>
            {plans.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={p.id === planId}
                onClick={() => changePlan(p.id)}
                className={`min-h-14 rounded-[14px] px-2 text-sm font-bold ${p.id === planId ? 'border-primary bg-primary-soft text-primary-ink border-2' : 'border-line bg-surface border-[1.5px]'}`}
              >
                <span className="block">{p.name}</span>
                <span className="text-muted block text-xs font-semibold">{formatRs(p.price)}</span>
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div>
        <Label htmlFor="rp-amt" className="text-muted text-[13px]">
          {m.payment.amount}
        </Label>
        <div className="border-primary bg-surface flex h-[60px] items-center gap-2 rounded-[14px] border-2 px-3.5">
          <span className="text-muted text-[22px] font-extrabold">Rs</span>
          <input
            id="rp-amt"
            inputMode="numeric"
            autoComplete="off"
            value={amount}
            onChange={(e) => {
              const v = parseAmount(e.target.value);
              setAmount(v === null ? '' : groupDigits(v));
            }}
            className="text-ink min-w-0 flex-1 bg-transparent text-[28px] font-extrabold outline-none"
          />
        </div>
      </div>

      <fieldset>
        <legend className="text-muted mb-1.5 text-[13px] font-bold">{m.payment.paidBy}</legend>
        <div className="grid grid-cols-2 gap-2">
          {PAYMENT_METHODS.map((x) => (
            <button
              key={x}
              type="button"
              aria-pressed={method === x}
              onClick={() => setMethod(x)}
              className={`min-h-[50px] rounded-[14px] text-base font-bold ${method === x ? 'border-primary bg-primary-soft text-primary-ink border-2' : 'border-line bg-surface border-[1.5px]'}`}
            >
              {m.methods[x]}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-[150px_minmax(0,1fr)] gap-2.5">
        <div>
          <Label htmlFor="rp-date" className="text-muted text-[13px]">
            {m.payment.date}
          </Label>
          <input
            id="rp-date"
            type="date"
            value={paidOn}
            max={today}
            onChange={(e) => e.target.value && setPaidOn(e.target.value)}
            className={`${inputClass} min-h-[50px] px-2 text-[15px] font-bold`}
          />
        </div>
        <div>
          <Label htmlFor="rp-note" className="text-muted text-[13px]">
            {m.payment.note}
          </Label>
          <Input
            id="rp-note"
            value={note}
            maxLength={300}
            onChange={(e) => setNote(e.target.value)}
            placeholder={m.payment.notePlaceholder}
            className="min-h-[50px] text-[15px]"
          />
        </div>
      </div>

      <div className="border-line -mx-4 border-y md:-mx-6">
        <Toggle label={m.payment.extend} hint={m.payment.extendHint} checked={extend} onChange={setExtendChoice} />
      </div>

      <div aria-live="polite" className={`rounded-2xl px-4 py-3.5 ${preview.cls}`}>
        <div className="text-[13px] font-bold">{preview.kicker}</div>
        <div className="mt-0.5 text-2xl font-extrabold">{preview.big}</div>
        {preview.small && <div className="mt-0.5 text-[13px] font-semibold">{preview.small}</div>}
      </div>

      <Button size="lg" onClick={save} loading={pending} disabled={n <= 0}>
        {n > 0 ? m.payment.save(formatRs(n)) : m.payment.saveEmpty}
      </Button>
    </Sheet>
  );
}
