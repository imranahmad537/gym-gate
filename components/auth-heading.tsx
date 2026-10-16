import type { ReactNode } from 'react';

export function AuthHeading({ title, subtitle, icon }: { title: string; subtitle?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-6">
      {icon && <span className="bg-primary-soft text-primary-ink mb-4 flex size-14 items-center justify-center rounded-full">{icon}</span>}
      <h1 className="text-[30px] leading-[1.1] font-bold tracking-[-0.035em]">{title}</h1>
      {subtitle && <p className="text-muted mt-2 text-[15px] leading-relaxed">{subtitle}</p>}
    </div>
  );
}
