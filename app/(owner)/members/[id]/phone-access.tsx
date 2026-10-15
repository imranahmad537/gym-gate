'use client';
import { Grid3x3, MessageCircle, Smartphone } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmSheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { m } from '@/messages';
import { createActivationLinkAction, decideDeviceRequestAction, resetDeviceAction } from '../../actions';

export function PhoneAccessCard({
  member,
  device,
  request,
}: {
  member: { id: string; firstName: string; last4: string; archived: boolean };
  device: { label: string; activatedOn: string } | null;
  request: { id: string; label: string; when: string } | null;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirmReset, setConfirmReset] = useState(false);
  const [busy, setBusy] = useState<'link' | 'approve' | 'decline' | null>(null);

  function run(kind: 'approve' | 'decline') {
    if (!request) return;
    setBusy(kind);
    startTransition(async () => {
      const res = await decideDeviceRequestAction(request.id, kind === 'approve');
      setBusy(null);
      if (res.ok) toast.show(kind === 'approve' ? m.toast.approved : m.toast.declined);
      else toast.error(res.error);
    });
  }

  async function sendLink() {
    setBusy('link');
    const res = await createActivationLinkAction(member.id);
    setBusy(null);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    window.location.href = res.waUrl;
  }

  return (
    <Card aria-labelledby="pa-h" className="flex flex-col gap-3.5 p-4">
      <div className="flex items-center justify-between">
        <h2 id="pa-h" className="text-lg font-extrabold">
          {m.member.phoneAccess}
        </h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-extrabold ${device ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-muted'}`}>
          {device ? m.member.activated : m.member.notActivated}
        </span>
      </div>

      {device ? (
        <div className="flex items-center gap-3">
          <span className="bg-surface-2 flex size-11 shrink-0 items-center justify-center rounded-xl">
            <Smartphone className="size-[22px]" aria-hidden />
          </span>
          <div>
            <div className="text-base font-extrabold">{device.label}</div>
            <div className="text-muted text-[13px] font-semibold">{m.member.activatedOn(device.activatedOn)}</div>
          </div>
        </div>
      ) : (
        <p className="text-muted text-[15px] leading-relaxed">{m.member.noPhone(member.firstName)}</p>
      )}

      {request && (
        <div className="bg-warn-soft text-warn flex flex-col gap-2.5 rounded-2xl p-3.5">
          <div className="text-[15px] font-extrabold">{m.member.newPhoneRequest}</div>
          <div className="text-sm leading-snug font-semibold">{m.member.newPhoneRequestBody(request.label, request.when, device?.label ?? null)}</div>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => run('approve')} loading={busy === 'approve'} disabled={pending}>
              {m.member.approve}
            </Button>
            <Button
              variant="secondary"
              onClick={() => run('decline')}
              loading={busy === 'decline'}
              disabled={pending}
              className="text-warn! border-current! bg-transparent!"
            >
              {m.member.decline}
            </Button>
          </div>
        </div>
      )}

      <div className="bg-surface-2 flex items-center justify-between rounded-[14px] px-3.5 py-3">
        <span className="inline-flex items-center gap-2.5 text-sm font-bold">
          <Grid3x3 className="size-5" aria-hidden />
          {m.member.keypadDigits}
        </span>
        <span className="text-[22px] font-extrabold tracking-[0.12em]">{member.last4}</span>
      </div>

      {!member.archived && (
        <Button variant={device ? 'soft' : 'primary'} onClick={sendLink} loading={busy === 'link'} icon={<MessageCircle className="size-[18px]" aria-hidden />}>
          {m.member.sendActivation}
        </Button>
      )}
      {device && (
        <Button variant="dangerOutline" onClick={() => setConfirmReset(true)}>
          {m.member.resetDevice}
        </Button>
      )}

      <ConfirmSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title={m.member.resetTitle(member.firstName)}
        body={m.member.resetBody(device?.label ?? 'phone', member.firstName)}
        confirmLabel={m.member.resetDevice}
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await resetDeviceAction(member.id);
            setConfirmReset(false);
            if (res.ok) toast.show(m.toast.deviceReset);
            else toast.error(res.error);
          })
        }
      />
    </Card>
  );
}
