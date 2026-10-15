import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';

export function PageHeader({
  title,
  subtitle,
  back,
  action,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: { href: string; label: string };
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-1 pt-2 pb-3 md:pt-6">
      {back && (
        <Link href={back.href} className="text-primary-ink -ml-2 inline-flex min-h-12 w-fit items-center gap-0.5 px-2 text-base font-bold">
          <ChevronLeft className="size-[22px]" aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-extrabold">{title}</h1>
          {subtitle && <div className="text-muted text-sm font-semibold">{subtitle}</div>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Page({ children, narrow }: { children: ReactNode; narrow?: boolean }) {
  return <main className={`mx-auto w-full px-4 md:px-7 ${narrow ? 'max-w-2xl' : 'max-w-6xl'}`}>{children}</main>;
}
