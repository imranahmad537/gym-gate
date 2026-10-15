'use client';
import { Archive, ArchiveRestore, Check, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/sheet';
import { useToast } from '@/components/ui/toast';
import { m } from '@/messages';
import { deletePaymentAction, setArchivedAction } from '../../actions';

export type HistoryItem = { id: string; date: string; line: string; amount: string; note: string | null };

export function PaymentHistory({ items }: { items: HistoryItem[] }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<string | null>(null);

  if (items.length === 0) return <p className="border-line text-muted border-t px-4 py-5 text-[15px] font-semibold">{m.member.noPayments}</p>;

  return (
    <>
      {items.map((p, i) => (
        <div key={p.id} className="border-line flex items-center gap-3 border-t px-4 py-3">
          <span className="bg-ok-soft text-ok flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Check className="size-5" strokeWidth={2.6} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-bold">{p.date}</div>
            <div className="text-muted truncate text-[13px] font-semibold">
              {p.line}
              {p.note ? ` · ${p.note}` : ''}
            </div>
          </div>
          <div className="text-base font-extrabold">{p.amount}</div>
          {i === 0 && (
            <button
              type="button"
              aria-label={m.member.deletePayment}
              onClick={() => setConfirm(p.id)}
              className="text-muted hover:bg-surface-2 -mr-2 flex size-11 items-center justify-center rounded-xl"
            >
              <Trash2 className="size-[18px]" aria-hidden />
            </button>
          )}
        </div>
      ))}
      <ConfirmSheet
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title={m.member.deletePaymentTitle}
        body={m.member.deletePaymentBody}
        confirmLabel={m.common.delete}
        pending={pending}
        onConfirm={() =>
          startTransition(async () => {
            const res = await deletePaymentAction(confirm!);
            setConfirm(null);
            if (res.ok) toast.show(m.payment.undone);
            else toast.error(res.error);
          })
        }
      />
    </>
  );
}

export function ArchiveButton({ memberId, firstName, archived }: { memberId: string; firstName: string; archived: boolean }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const toggle = () =>
    startTransition(async () => {
      const res = await setArchivedAction(memberId, !archived);
      setOpen(false);
      if (res.ok) toast.show(archived ? m.toast.restored : m.toast.archived);
      else toast.error(res.error);
    });

  if (archived) {
    return (
      <Button variant="secondary" onClick={toggle} loading={pending} icon={<ArchiveRestore className="size-[18px]" aria-hidden />}>
        {m.member.restore}
      </Button>
    );
  }
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} icon={<Archive className="size-[18px]" aria-hidden />} className="text-muted!">
        {m.member.archive}
      </Button>
      <ConfirmSheet
        open={open}
        onClose={() => setOpen(false)}
        title={m.member.archiveTitle(firstName)}
        body={m.member.archiveBody}
        confirmLabel={m.member.archive}
        pending={pending}
        onConfirm={toggle}
      />
    </>
  );
}
