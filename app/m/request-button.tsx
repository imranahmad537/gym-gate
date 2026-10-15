'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { m } from '@/messages';

/** "Ask to use this phone" — sends a device-switch request to the front desk. */
export function RequestSwitchButton({ code }: { code?: string }) {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'expired' | 'error'>('idle');
  if (state === 'sent') {
    return (
      <div role="status" className="bg-ok-soft text-ok rounded-2xl px-4 py-3.5 text-left">
        <div className="text-base font-extrabold">{m.phone.requestSent}</div>
        <div className="mt-0.5 text-sm font-semibold">{m.phone.requestSentBody}</div>
      </div>
    );
  }
  return (
    <>
      {(state === 'error' || state === 'expired') && (
        <p role="alert" className="text-bad text-sm font-bold">
          {state === 'expired' ? m.phone.linkExpiredBody : m.common.somethingWrong}
        </p>
      )}
      <Button
        size="lg"
        loading={state === 'busy'}
        onClick={async () => {
          setState('busy');
          try {
            const res = await fetch('/api/m/request', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
            const data = (await res.json()) as { status: string };
            if (data.status === 'already') router.push('/m');
            else setState(data.status === 'sent' || data.status === 'expired' ? data.status : 'error');
          } catch {
            setState('error');
          }
        }}
      >
        {m.phone.requestSwitch}
      </Button>
    </>
  );
}
