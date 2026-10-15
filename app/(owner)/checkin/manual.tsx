'use client';
import { Search, Tablet } from 'lucide-react';
import { useDeferredValue, useMemo, useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/submit-button';
import { StatusBadge } from '@/components/ui/status-badge';
import { useToast } from '@/components/ui/toast';
import type { FeeInfo } from '@/lib/status';
import { m } from '@/messages';
import { manualCheckinAction, startKioskAction } from '../actions';

export function StartKioskButton() {
  return (
    <form action={startKioskAction}>
      <SubmitButton size="lg" className="w-full" icon={<Tablet className="size-5" aria-hidden />}>
        {m.settings.startKiosk}
      </SubmitButton>
    </form>
  );
}

type Row = { id: string; no: number; name: string; digits: string; photoUrl: string | null; fee: FeeInfo };

export function ManualCheckin({ members }: { members: Row[] }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);
  const [busy, setBusy] = useState<string | null>(null);
  const [, start] = useTransition();

  const rows = useMemo(() => {
    const t = query.trim().toLowerCase();
    const d = query.replace(/\D/g, '');
    if (!t) return [];
    return members.filter((x) => x.name.toLowerCase().includes(t) || (d && (String(x.no).includes(d) || x.digits.endsWith(d)))).slice(0, 20);
  }, [members, query]);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search className="text-muted pointer-events-none absolute top-[15px] left-3.5 size-[22px]" aria-hidden />
        <input
          type="search"
          aria-label={m.members.search}
          placeholder={m.members.searchPlaceholder}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="border-line bg-surface focus:border-primary h-[52px] w-full rounded-[14px] border-[1.5px] pr-3.5 pl-[46px] text-base font-semibold focus:outline-none"
        />
      </div>
      {rows.length > 0 && (
        <ul className="border-line bg-surface overflow-hidden rounded-[20px] border">
          {rows.map((x) => (
            <li key={x.id} className="border-line flex items-center gap-3 border-b px-3.5 py-3 last:border-b-0">
              <Avatar name={x.name} seed={x.no} photoUrl={x.photoUrl} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-base font-bold">{x.name}</span>
                <StatusBadge info={x.fee} />
              </span>
              <Button
                size="sm"
                loading={busy === x.id}
                onClick={() => {
                  setBusy(x.id);
                  start(async () => {
                    const res = await manualCheckinAction(x.id);
                    setBusy(null);
                    if (!res.ok) toast.error(res.error);
                    else toast.show(res.repeat ? m.kiosk.already : m.checkinPage.checkedIn(x.name));
                  });
                }}
              >
                {m.checkinPage.checkIn}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
