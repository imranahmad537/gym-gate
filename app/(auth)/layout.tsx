import { Dumbbell } from 'lucide-react';
import { m } from '@/messages';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center gap-3 px-1">
        <span className="bg-primary text-on-primary flex size-12 shrink-0 items-center justify-center rounded-full">
          <Dumbbell className="size-6" aria-hidden />
        </span>
        <span className="min-w-0">
          <span className="block text-xl font-bold tracking-[-0.02em]">{m.app.name}</span>
          <span className="from-accent to-accent-2 mt-0.5 inline-block rounded-full bg-linear-to-r px-2.5 py-0.5 text-xs font-semibold text-[#111114]">
            {m.app.tagline}
          </span>
        </span>
      </div>
      <div className="bg-surface rounded-[32px] p-6 shadow-[0_1px_2px_rgba(17,17,20,0.04),0_12px_32px_-12px_rgba(17,17,20,0.08)] sm:p-7">{children}</div>
    </main>
  );
}
