import type { ReactNode } from 'react';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`skeleton rounded-md ${className}`} />;
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: ReactNode; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="border-line bg-surface flex flex-col items-center gap-3 rounded-[24px] border-[1.5px] border-dashed px-5 py-9 text-center">
      {icon && <span className="bg-primary-soft text-primary-ink flex size-[72px] items-center justify-center rounded-full">{icon}</span>}
      <div className="text-[19px] font-extrabold">{title}</div>
      {body && <div className="text-muted max-w-sm text-[15px] leading-relaxed">{body}</div>}
      {action}
    </div>
  );
}

export function Dot({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`inline-block size-2.5 shrink-0 rounded-full ${className}`} />;
}
