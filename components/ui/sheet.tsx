'use client';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { m } from '@/messages';
import { Button } from './button';

/**
 * Bottom sheet on phones, centred dialog on tablets. Built on <dialog> so
 * focus trapping, Escape and screen-reader semantics come for free.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  role = 'dialog',
  hideClose,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  role?: 'dialog' | 'alertdialog';
  hideClose?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role={role}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="bg-surface fixed inset-x-0 top-auto bottom-0 m-0 max-h-[92dvh] w-full max-w-none overflow-y-auto rounded-t-[26px] p-0 md:inset-0 md:m-auto md:h-fit md:max-w-md md:rounded-[24px]"
    >
      {open && (
        <div className="animate-sheet-up safe-bottom flex flex-col gap-4 px-4 pt-2.5 pb-5 md:px-6 md:pt-6">
          <div aria-hidden className="bg-line mx-auto h-[5px] w-11 rounded-full md:hidden" />
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id={titleId} className="text-[22px] leading-tight font-extrabold">
                {title}
              </h2>
              {subtitle && <div className="text-muted mt-0.5 text-sm font-semibold">{subtitle}</div>}
            </div>
            {!hideClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label={m.common.close}
                className="bg-surface-2 flex size-12 shrink-0 items-center justify-center rounded-[14px]"
              >
                <X className="size-5" aria-hidden />
              </button>
            )}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  body,
  confirmLabel,
  danger = true,
  pending,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  body: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} title={title} role="alertdialog" hideClose>
      <p className="text-muted text-[15px] leading-relaxed">{body}</p>
      <Button variant={danger ? 'danger' : 'primary'} size="lg" onClick={onConfirm} loading={pending}>
        {confirmLabel}
      </Button>
      <Button variant="secondary" size="lg" onClick={onClose} disabled={pending}>
        {m.common.cancel}
      </Button>
    </Sheet>
  );
}
