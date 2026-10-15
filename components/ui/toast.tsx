'use client';
import { Check, TriangleAlert } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Toast = {
  id: number;
  message: string;
  kind: 'ok' | 'error';
  action?: { label: string; onClick: () => void };
};

type ToastApi = {
  show: (message: string, opts?: { kind?: 'ok' | 'error'; action?: Toast['action']; durationMs?: number }) => void;
  error: (message: string) => void;
};

const Ctx = createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ToastApi['show']>(
    (message, opts) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { id, message, kind: opts?.kind ?? 'ok', action: opts?.action }]);
      setTimeout(() => dismiss(id), opts?.durationMs ?? (opts?.action ? 5000 : 3500));
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(() => ({ show, error: (msg) => show(msg, { kind: 'error' }) }), [show]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 top-3 z-[100] mx-auto flex max-w-md flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="animate-sheet-up pointer-events-auto flex min-h-14 items-center gap-3 rounded-2xl bg-[#0e1b14] px-4 text-white shadow-[0_10px_24px_rgba(0,0,0,0.3)]"
          >
            <span className={`flex size-[30px] shrink-0 items-center justify-center rounded-full ${t.kind === 'ok' ? 'bg-[#1f9d55]' : 'bg-[#d93434]'}`}>
              {t.kind === 'ok' ? <Check className="size-[18px]" strokeWidth={3} aria-hidden /> : <TriangleAlert className="size-[18px]" aria-hidden />}
            </span>
            <span className="flex-1 py-2 text-[15px] font-bold">{t.message}</span>
            {t.action && (
              <button
                type="button"
                className="min-h-11 px-1 text-[15px] font-extrabold text-[#8ee0b0]"
                onClick={() => {
                  t.action?.onClick();
                  dismiss(t.id);
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
