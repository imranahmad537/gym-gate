import { Dumbbell } from 'lucide-react';
import { m } from '@/messages';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-7 flex items-center gap-3">
        <span className="bg-primary flex size-12 items-center justify-center rounded-[14px] text-white">
          <Dumbbell className="size-6" aria-hidden />
        </span>
        <span>
          <span className="block text-2xl font-extrabold">{m.app.name}</span>
          <span className="text-muted block text-sm font-semibold">{m.app.tagline}</span>
        </span>
      </div>
      <div className="border-line bg-surface rounded-[24px] border p-5">{children}</div>
    </main>
  );
}
