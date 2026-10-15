'use client';
import { startAuthentication, startRegistration } from '@simplewebauthn/browser';
import type { PublicKeyCredentialCreationOptionsJSON, PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { Clock, Fingerprint, LoaderCircle, QrCode, Smartphone, TriangleAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { CheckinResult } from '@/lib/types';
import { m } from '@/messages';
import { CheckinResultView, PhoneShell, StatusScreen } from '../ui';
import { RequestSwitchButton } from '../request-button';

type GymInfo = { name: string; tz: string; kiosk: string };
type Response =
  | { status: 'ok'; result: CheckinResult; gym: GymInfo }
  | { status: 'passkey'; mode: 'register' | 'auth'; options: unknown; ticket: string; gym: GymInfo }
  | { status: 'expired' | 'invalid' | 'unregistered' | 'other_device' | 'archived' | 'passkey_failed'; gym?: GymInfo };

type View = Response | { status: 'loading' } | { status: 'network' } | { status: 'unsupported'; gym?: GymInfo };

const KNOWN_STATUSES = new Set(['ok', 'passkey', 'expired', 'invalid', 'unregistered', 'other_device', 'archived', 'passkey_failed']);

/** A server error (500 page, proxy HTML, unknown status) shows the retry screen instead of a blank one. */
async function readResponse(res: globalThis.Response): Promise<View> {
  const data = res.ok ? ((await res.json().catch(() => null)) as Response | null) : null;
  return data && KNOWN_STATUSES.has(data.status) ? data : { status: 'network' };
}

export function CheckinClient({ k, w, t }: { k: string; w: string; t: string }) {
  const [view, setView] = useState<View>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  async function send() {
    setView({ status: 'loading' });
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ k, w, t }),
        cache: 'no-store',
      });
      setView(await readResponse(res));
    } catch {
      setView({ status: 'network' });
    }
  }

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Strip the one-time token from the address bar so a refresh or share cannot reuse it.
    window.history.replaceState(null, '', '/m/c');
    void send();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per scan
  }, []);

  async function confirmPasskey(v: Extract<Response, { status: 'passkey' }>) {
    setBusy(true);
    try {
      const response =
        v.mode === 'register'
          ? await startRegistration({ optionsJSON: v.options as PublicKeyCredentialCreationOptionsJSON })
          : await startAuthentication({ optionsJSON: v.options as PublicKeyCredentialRequestOptionsJSON });
      const res = await fetch('/api/checkin/passkey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: v.ticket, response }),
      });
      setView(await readResponse(res));
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      setView(name === 'NotSupportedError' ? { status: 'unsupported', gym: v.gym } : { status: 'passkey_failed', gym: v.gym });
    } finally {
      setBusy(false);
    }
  }

  const gymName = 'gym' in view ? view.gym?.name : undefined;

  return (
    <PhoneShell gymName={gymName}>
      {view.status === 'loading' && (
        <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4 pb-24">
          <LoaderCircle className="text-primary-ink size-14 animate-spin" aria-hidden />
          <div className="text-lg font-bold">{m.phone.checkingIn}</div>
        </div>
      )}
      {view.status === 'ok' && <CheckinResultView result={view.result} tz={view.gym.tz} kioskName={view.gym.kiosk} />}
      {view.status === 'passkey' && (
        <StatusScreen
          icon={<Fingerprint className="size-16" aria-hidden />}
          tone="ok"
          title={view.mode === 'register' ? m.phone.passkeySetupTitle : m.phone.passkeyTitle}
          body={view.mode === 'register' ? m.phone.passkeySetupBody : m.phone.passkeyBody}
        >
          <Button
            size="lg"
            className="min-h-16 text-lg"
            loading={busy}
            onClick={() => confirmPasskey(view)}
            icon={<Fingerprint className="size-6" aria-hidden />}
          >
            {m.phone.useFingerprint}
          </Button>
        </StatusScreen>
      )}
      {view.status === 'passkey_failed' && (
        <StatusScreen icon={<Fingerprint className="size-14" aria-hidden />} tone="bad" title={m.phone.passkeyTitle} body={m.phone.passkeyFailed} />
      )}
      {view.status === 'unsupported' && (
        <StatusScreen icon={<Fingerprint className="size-14" aria-hidden />} title={m.phone.passkeyTitle} body={m.phone.passkeyUnsupported} />
      )}
      {view.status === 'expired' && (
        <StatusScreen icon={<Clock className="size-14" aria-hidden />} tone="warn" title={m.phone.expiredTitle} body={m.phone.expiredBody} />
      )}
      {view.status === 'invalid' && <StatusScreen icon={<QrCode className="size-14" aria-hidden />} title={m.phone.invalidTitle} body={m.phone.invalidBody} />}
      {view.status === 'unregistered' && (
        <StatusScreen icon={<Smartphone className="size-14" aria-hidden />} title={m.phone.unregisteredTitle} body={m.phone.unregisteredBody} />
      )}
      {view.status === 'archived' && (
        <StatusScreen icon={<Smartphone className="size-14" aria-hidden />} title={m.phone.archivedTitle} body={m.phone.archivedBody} />
      )}
      {view.status === 'other_device' && (
        <StatusScreen icon={<Smartphone className="size-14" aria-hidden />} tone="warn" title={m.phone.otherDeviceTitle} body={m.phone.otherDeviceBody}>
          <RequestSwitchButton />
        </StatusScreen>
      )}
      {view.status === 'network' && (
        <StatusScreen icon={<TriangleAlert className="size-14" aria-hidden />} tone="bad" title={m.common.offlineTryAgain}>
          <Button size="lg" onClick={send}>
            {m.common.retry}
          </Button>
        </StatusScreen>
      )}
    </PhoneShell>
  );
}
