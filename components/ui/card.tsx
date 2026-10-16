import type { ComponentProps, ReactNode } from 'react';

export function Card({ className = '', ...props }: ComponentProps<'section'>) {
  return <section className={`bg-surface rounded-[28px] ${className}`} {...props} />;
}

export function CardHeader({ title, id, action }: { title: ReactNode; id?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2">
      <h2 id={id} className="text-xl font-bold">
        {title}
      </h2>
      {action}
    </div>
  );
}

export function Row({ className = '', ...props }: ComponentProps<'div'>) {
  return <div className={`border-line flex items-center gap-3 border-t px-5 py-3 ${className}`} {...props} />;
}
