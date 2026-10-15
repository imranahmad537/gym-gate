'use client';
import { CalendarDays, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { PhotoInput } from '@/components/photo-input';
import { Button, ButtonAnchor } from '@/components/ui/button';
import { FieldError, Hint, Input, Label, inputClass } from '@/components/ui/field';
import { Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { addDays, formatDate, isDateString } from '@/lib/dates';
import { formatRs, groupDigits, parseAmount } from '@/lib/money';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/types';
import { m } from '@/messages';
import { createMemberAction, updateMemberAction } from '../actions';

type PlanOption = { id: string; name: string; duration_days: number; price: number };

export function MemberForm({
  plans,
  today,
  member,
}: {
  plans: PlanOption[];
  today: string;
  member?: { id: string; name: string; phone: string; planId: string | null; note: string | null; photoUrl: string | null };
}) {
  const router = useRouter();
  const toast = useToast();
  const editing = Boolean(member);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(member?.name ?? '');
  const [phone, setPhone] = useState(member?.phone.replace(/^\+92/, '') ?? '');
  const [planId, setPlanId] = useState(member?.planId ?? plans[0]?.id ?? '');
  const [start, setStart] = useState(today);
  const plan = plans.find((p) => p.id === planId);
  const [amount, setAmount] = useState(plan ? groupDigits(plan.price) : '');
  const [amountTouched, setAmountTouched] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>('cash');
  const [note, setNote] = useState(member?.note ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [created, setCreated] = useState<{ id: string; memberNo: number; name: string; waUrl: string } | null>(null);

  const paid = parseAmount(amount);
  const validTill = plan && isDateString(start) && paid !== null ? addDays(start, plan.duration_days - 1) : null;

  function pickPlan(id: string) {
    setPlanId(id);
    const p = plans.find((x) => x.id === id);
    if (p && !amountTouched) setAmount(groupDigits(p.price));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const form = new FormData();
    form.set('name', name);
    form.set('phone', phone);
    form.set('planId', planId);
    form.set('note', note);
    if (!editing) {
      form.set('start', start);
      form.set('amount', amount);
      form.set('method', method);
    }
    if (photo) form.set('photo', photo, 'photo.jpg');
    startTransition(async () => {
      if (editing) {
        const res = await updateMemberAction(member!.id, form);
        if (!res.ok) {
          setErrors(res.fields ?? {});
          toast.error(res.error);
          return;
        }
        toast.show(m.toast.memberSaved);
        router.push(`/members/${member!.id}`);
        return;
      }
      const res = await createMemberAction(form);
      if (!res.ok) {
        setErrors(res.fields ?? {});
        toast.error(res.error);
        return;
      }
      setErrors({});
      setCreated({ id: res.id, memberNo: res.memberNo, name: res.name, waUrl: res.waUrl });
    });
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-[18px] pb-28">
        <PhotoInput initialUrl={member?.photoUrl} onChange={setPhoto} />
        {errors.photo && <FieldError>{errors.photo}</FieldError>}

        <div>
          <Label htmlFor="mf-name">{m.form.name}</Label>
          <Input
            id="mf-name"
            autoComplete="name"
            placeholder={m.form.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? 'mf-name-err' : undefined}
            required
          />
          <FieldError id="mf-name-err">{errors.name}</FieldError>
        </div>

        <div>
          <Label htmlFor="mf-phone">{m.form.phone}</Label>
          <div className="border-line bg-surface focus-within:border-primary flex min-h-[54px] overflow-hidden rounded-[14px] border-[1.5px]">
            <span className="bg-surface-2 text-muted flex items-center px-3 text-base font-extrabold">+92</span>
            <input
              id="mf-phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel-national"
              placeholder={m.form.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby="mf-phone-hint"
              className="text-ink placeholder:text-muted/70 min-w-0 flex-1 bg-transparent px-3 text-[17px] font-semibold outline-none"
              required
            />
          </div>
          <FieldError>{errors.phone}</FieldError>
          <Hint id="mf-phone-hint">{m.form.phoneHint}</Hint>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-sm font-bold">{m.form.plan}</legend>
          <div className="flex flex-col gap-2">
            {plans.map((p) => {
              const on = p.id === planId;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickPlan(p.id)}
                  className={`flex min-h-[60px] items-center gap-3 rounded-[14px] px-4 text-left ${on ? 'border-primary bg-primary-soft border-2' : 'border-line bg-surface border-[1.5px]'}`}
                >
                  <span className={`size-[22px] shrink-0 rounded-full ${on ? 'border-primary bg-surface border-[7px]' : 'border-muted border-2'}`} />
                  <span className="flex-1">
                    <span className="block text-base font-extrabold">{p.name}</span>
                    <span className="text-muted block text-[13px] font-semibold">{m.form.planDays(p.duration_days)}</span>
                  </span>
                  <span className="text-[17px] font-extrabold">{formatRs(p.price)}</span>
                </button>
              );
            })}
          </div>
          <FieldError>{errors.planId}</FieldError>
        </fieldset>

        {!editing && (
          <>
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <Label htmlFor="mf-start">{m.form.startDate}</Label>
                <input
                  id="mf-start"
                  type="date"
                  value={start}
                  max={addDays(today, 31)}
                  onChange={(e) => e.target.value && setStart(e.target.value)}
                  className={`${inputClass} px-2.5 text-[15px] font-bold`}
                />
              </div>
              <div>
                <Label htmlFor="mf-pay">{m.form.paidNow}</Label>
                <Input
                  id="mf-pay"
                  inputMode="numeric"
                  value={amount}
                  onChange={(e) => {
                    setAmountTouched(true);
                    const n = parseAmount(e.target.value);
                    setAmount(n === null ? '' : groupDigits(n));
                  }}
                  className="font-extrabold"
                  aria-describedby="mf-pay-hint"
                />
              </div>
            </div>
            <Hint id="mf-pay-hint">{m.form.paidNowHint}</Hint>

            {paid !== null && (
              <fieldset>
                <legend className="mb-1.5 text-sm font-bold">{m.form.method}</legend>
                <div className="grid grid-cols-4 gap-2">
                  {PAYMENT_METHODS.map((x) => (
                    <button
                      key={x}
                      type="button"
                      aria-pressed={method === x}
                      onClick={() => setMethod(x)}
                      className={`min-h-12 rounded-xl text-[13px] font-bold ${method === x ? 'border-primary bg-primary-soft text-primary-ink border-2' : 'border-line bg-surface border-[1.5px]'}`}
                    >
                      {m.methods[x]}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            <div
              aria-live="polite"
              className={`flex items-center gap-3 rounded-2xl px-4 py-3.5 ${validTill ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted'}`}
            >
              <CalendarDays className="size-[26px] shrink-0" aria-hidden />
              {validTill && plan ? (
                <div>
                  <div className="text-[13px] font-bold">{m.form.validTill}</div>
                  <div className="text-2xl leading-tight font-extrabold">{formatDate(validTill)}</div>
                  <div className="text-[13px] font-semibold">{m.form.validCalc(formatDate(start), plan.duration_days)}</div>
                </div>
              ) : (
                <div className="text-sm font-bold">{m.form.notPaidYet}</div>
              )}
            </div>
          </>
        )}

        <div>
          <Label htmlFor="mf-note">
            {m.form.note} <span className="text-muted font-semibold">({m.common.optional})</span>
          </Label>
          <Input id="mf-note" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} />
        </div>

        <div className="safe-bottom border-line bg-surface fixed inset-x-0 bottom-0 z-40 border-t px-4 pt-3.5 pb-4 md:static md:border-0 md:bg-transparent md:p-0">
          <Button type="submit" size="lg" loading={pending} className="w-full">
            {editing ? m.form.saveChanges : m.form.save}
          </Button>
        </div>
      </form>

      <Sheet
        open={Boolean(created)}
        onClose={() => created && router.replace(`/members/${created.id}`)}
        title={m.form.added}
        subtitle={created ? m.form.addedSub(created.name, created.memberNo) : undefined}
      >
        <p className="text-muted text-[15px] leading-relaxed">{m.form.addedBody}</p>
        {created && (
          <ButtonAnchor
            href={created.waUrl}
            size="lg"
            onClick={() => router.replace(`/members/${created.id}`)}
            icon={<MessageCircle className="size-5" aria-hidden />}
          >
            {m.form.sendActivation}
          </ButtonAnchor>
        )}
        <Button variant="secondary" size="lg" onClick={() => created && router.replace(`/members/${created.id}`)}>
          {m.form.skip}
        </Button>
      </Sheet>
    </>
  );
}
