'use client';
import { ChevronRight, LogOut, Pencil, Plus, Tablet } from 'lucide-react';
import { useState, useTransition, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/submit-button';
import { Input, Label, Segmented, Toggle } from '@/components/ui/field';
import { ConfirmSheet, Sheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { formatRs, groupDigits, parseAmount } from '@/lib/money';
import { m } from '@/messages';
import {
  changePinAction,
  removeKioskAction,
  savePlanAction,
  setPlanActiveAction,
  setThemeAction,
  signOutAction,
  startKioskAction,
  updateGymAction,
  updateKioskSettingsAction,
  updateSecurityAction,
} from '../actions';
import type { ActionResult } from '@/lib/action';

function Section({ id, title, action, children }: { id: string; title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-2.5 flex items-center justify-between">
        <h2 id={id} className="text-lg font-extrabold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Box({ children }: { children: ReactNode }) {
  return <div className="divide-line border-line bg-surface divide-y overflow-hidden rounded-[18px] border">{children}</div>;
}

/** Runs an action, shows a toast, and returns whether it worked. */
function useSave() {
  const toast = useToast();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<ActionResult>, okMsg: string = m.settings.saved, after?: () => void) =>
    start(async () => {
      const res = await fn();
      if (res.ok) {
        toast.show(okMsg);
        after?.();
      } else toast.error(res.error);
    });
  return { pending, run };
}

// ---------------------------------------------------------------------------

type PlanRow = { id: string; name: string; days: number; price: number; active: boolean; members: number };

export function PlansSection({ plans }: { plans: PlanRow[] }) {
  const [editing, setEditing] = useState<PlanRow | 'new' | null>(null);
  const { pending, run } = useSave();
  return (
    <Section
      id="pl-h"
      title={m.settings.plans}
      action={
        <Button variant="soft" size="sm" onClick={() => setEditing('new')} icon={<Plus className="size-[18px]" aria-hidden />}>
          {m.settings.addPlan}
        </Button>
      }
    >
      <div className="flex flex-col gap-2.5">
        {plans.map((p) => (
          <div key={p.id} className={`border-line bg-surface rounded-[18px] border p-4 ${p.active ? '' : 'opacity-60'}`}>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="text-lg font-extrabold">
                  {p.name} {!p.active && <span className="text-muted ml-1 text-xs font-bold">({m.settings.hidden})</span>}
                </div>
                <div className="text-muted text-[13px] font-semibold">
                  {m.form.planDays(p.days)} · {m.settings.planMembers(p.members)}
                </div>
              </div>
              <div className="text-[22px] font-extrabold">{formatRs(p.price)}</div>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setEditing(p)} icon={<Pencil className="size-4" aria-hidden />}>
                {m.settings.editPlan}
              </Button>
              <Button variant="ghost" size="sm" loading={pending} onClick={() => run(() => setPlanActiveAction(p.id, !p.active))}>
                {p.active ? m.settings.hidePlan : m.settings.showPlan}
              </Button>
            </div>
          </div>
        ))}
      </div>
      {editing && <PlanSheet plan={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Section>
  );
}

function PlanSheet({ plan, onClose }: { plan: PlanRow | null; onClose: () => void }) {
  const [name, setName] = useState(plan?.name ?? '');
  const [days, setDays] = useState(String(plan?.days ?? 30));
  const [price, setPrice] = useState(plan ? groupDigits(plan.price) : '');
  const { pending, run } = useSave();
  return (
    <Sheet open onClose={onClose} title={plan ? m.settings.editPlan : m.settings.addPlan}>
      <div>
        <Label htmlFor="pl-name">{m.settings.planName}</Label>
        <Input id="pl-name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder="Monthly" />
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <Label htmlFor="pl-days">{m.settings.planDays}</Label>
          <Input id="pl-days" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, '').slice(0, 4))} />
        </div>
        <div>
          <Label htmlFor="pl-price">{m.settings.planPrice}</Label>
          <Input
            id="pl-price"
            inputMode="numeric"
            value={price}
            onChange={(e) => {
              const n = parseAmount(e.target.value);
              setPrice(n === null ? '' : groupDigits(n));
            }}
            className="font-extrabold"
          />
        </div>
      </div>
      <p className="text-muted text-[13px] font-semibold">{m.settings.planHint}</p>
      <Button
        size="lg"
        loading={pending}
        disabled={!name.trim() || !days || !price}
        onClick={() => run(() => savePlanAction({ id: plan?.id, name, durationDays: days, price: parseAmount(price) ?? 0 }), m.settings.planSaved, onClose)}
      >
        {m.common.save}
      </Button>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

export function KioskSection({
  settings,
  kiosks,
}: {
  settings: { qrIntervalSecs: 15 | 20 | 30; resultSecs: number; keypadEnabled: boolean };
  kiosks: { id: string; name: string; lastSeen: string | null }[];
}) {
  const [s, setS] = useState(settings);
  const [pinOpen, setPinOpen] = useState(false);
  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const { pending, run } = useSave();
  const update = (next: typeof s) => {
    setS(next);
    run(() => updateKioskSettingsAction(next));
  };

  return (
    <Section id="ks-h" title={m.settings.kiosk}>
      <Box>
        <div className="px-4 py-3.5">
          <div id="qr-l" className="text-[15px] font-bold">
            {m.settings.qrInterval}
          </div>
          <div className="mt-2.5">
            <Segmented
              labelledBy="qr-l"
              options={[15, 20, 30] as const}
              value={s.qrIntervalSecs}
              onChange={(v) => update({ ...s, qrIntervalSecs: v })}
              render={(v) => m.settings.secs(v)}
            />
          </div>
        </div>
        <div className="px-4 py-3.5">
          <div id="rd-l" className="text-[15px] font-bold">
            {m.settings.resultSecs}
          </div>
          <div className="mt-2.5">
            <Segmented
              labelledBy="rd-l"
              options={[3, 4, 6] as const}
              value={s.resultSecs as 3 | 4 | 6}
              onChange={(v) => update({ ...s, resultSecs: v })}
              render={(v) => m.settings.secs(v)}
            />
          </div>
        </div>
        <Toggle
          label={m.settings.keypad}
          hint={m.settings.keypadHint}
          checked={s.keypadEnabled}
          disabled={pending}
          onChange={(v) => update({ ...s, keypadEnabled: v })}
        />
        <button
          type="button"
          onClick={() => setPinOpen(true)}
          className="hover:bg-surface-2 flex min-h-16 w-full items-center justify-between gap-3 px-4 py-2.5 text-left"
        >
          <span>
            <span className="block text-[15px] font-bold">{m.settings.kioskPin}</span>
            <span className="text-muted block text-[13px] font-semibold">{m.settings.kioskPinHint}</span>
          </span>
          <ChevronRight className="size-5 shrink-0" aria-hidden />
        </button>
      </Box>

      <h3 className="mt-5 mb-2 text-[15px] font-extrabold">{m.settings.kiosks}</h3>
      <Box>
        {kiosks.length === 0 && <p className="text-muted px-4 py-4 text-[15px] font-semibold">{m.settings.noKiosks}</p>}
        {kiosks.map((k) => (
          <div key={k.id} className="flex items-center gap-3 px-4 py-3">
            <span className="bg-surface-2 flex size-10 shrink-0 items-center justify-center rounded-xl">
              <Tablet className="size-5" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-bold">{k.name}</span>
              <span className="text-muted block text-[13px] font-semibold">{k.lastSeen ? m.settings.lastSeen(k.lastSeen) : m.settings.neverSeen}</span>
            </span>
            <Button variant="ghost" size="sm" className="text-bad!" onClick={() => setRemoving(k)}>
              {m.settings.removeKiosk}
            </Button>
          </div>
        ))}
      </Box>
      <form action={startKioskAction} className="mt-3">
        <SubmitButton size="lg" className="w-full" icon={<Tablet className="size-5" aria-hidden />}>
          {m.settings.startKiosk}
        </SubmitButton>
      </form>
      <p className="text-muted mt-2 text-[13px] leading-relaxed font-semibold">{m.settings.startKioskHint}</p>

      {pinOpen && <PinSheet onClose={() => setPinOpen(false)} />}
      <ConfirmSheet
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={removing ? m.settings.removeKioskTitle(removing.name) : ''}
        body={m.settings.removeKioskBody}
        confirmLabel={m.settings.removeKiosk}
        pending={pending}
        onConfirm={() =>
          removing &&
          run(
            () => removeKioskAction(removing.id),
            m.toast.kioskRemoved,
            () => setRemoving(null),
          )
        }
      />
    </Section>
  );
}

function PinSheet({ onClose }: { onClose: () => void }) {
  const [pin, setPin] = useState('');
  const { pending, run } = useSave();
  return (
    <Sheet open onClose={onClose} title={m.settings.changePin}>
      <div>
        <Label htmlFor="new-pin">{m.settings.newPin}</Label>
        <Input
          id="new-pin"
          inputMode="numeric"
          autoComplete="off"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
          className="max-w-40 text-center text-2xl tracking-[0.4em]"
        />
      </div>
      <Button size="lg" disabled={pin.length !== 4} loading={pending} onClick={() => run(() => changePinAction(pin), m.settings.pinSaved, onClose)}>
        {m.common.save}
      </Button>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------

export function SecuritySection({ settings }: { settings: { requirePasskey: boolean; oneDevicePerMember: boolean } }) {
  const [s, setS] = useState(settings);
  const { pending, run } = useSave();
  const update = (next: typeof s) => {
    setS(next);
    run(() => updateSecurityAction(next));
  };
  return (
    <Section id="sc-h" title={m.settings.security}>
      <Box>
        <Toggle
          label={m.settings.passkey}
          hint={m.settings.passkeyHint}
          checked={s.requirePasskey}
          disabled={pending}
          onChange={(v) => update({ ...s, requirePasskey: v })}
        />
        <Toggle
          label={m.settings.oneDevice}
          hint={m.settings.oneDeviceHint}
          checked={s.oneDevicePerMember}
          disabled={pending}
          onChange={(v) => update({ ...s, oneDevicePerMember: v })}
        />
      </Box>
    </Section>
  );
}

export function GymSection({ gym }: { gym: { name: string; phone: string } }) {
  const [name, setName] = useState(gym.name);
  const [phone, setPhone] = useState(gym.phone);
  const { pending, run } = useSave();
  const dirty = name !== gym.name || phone !== gym.phone;
  return (
    <Section id="gy-h" title={m.settings.gym}>
      <div className="border-line bg-surface flex flex-col gap-3 rounded-[18px] border p-4">
        <div>
          <Label htmlFor="gym-name">{m.settings.gymName}</Label>
          <Input id="gym-name" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="gym-phone">{m.settings.gymPhone}</Label>
          <Input id="gym-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="text-muted flex items-center justify-between gap-3 text-sm font-semibold">
          <span>
            {m.settings.language}: {m.settings.languageValue}
          </span>
          <Button disabled={!dirty} loading={pending} onClick={() => run(() => updateGymAction({ name, phone }))}>
            {m.common.save}
          </Button>
        </div>
      </div>
    </Section>
  );
}

export function ThemeSection({ theme }: { theme: 'system' | 'light' | 'dark' }) {
  const [t, setT] = useState(theme);
  const [, start] = useTransition();
  return (
    <Section id="th-h" title={m.settings.appearance}>
      <Segmented
        labelledBy="th-h"
        options={['system', 'light', 'dark'] as const}
        value={t}
        onChange={(v) => {
          setT(v);
          if (v === 'system') delete document.documentElement.dataset.theme;
          else document.documentElement.dataset.theme = v;
          start(() => setThemeAction(v));
        }}
        render={(v) => m.settings.theme[v]}
      />
    </Section>
  );
}

export function AccountSection({ email }: { email: string }) {
  return (
    <Section id="ac-h" title={m.settings.account}>
      <div className="border-line bg-surface flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3">
        <span className="text-muted min-w-0 truncate text-[15px] font-semibold">{email}</span>
        <form action={signOutAction}>
          <SubmitButton variant="secondary" size="sm" icon={<LogOut className="size-4" aria-hidden />}>
            {m.auth.signOut}
          </SubmitButton>
        </form>
      </div>
    </Section>
  );
}
