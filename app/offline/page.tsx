import { WifiOff } from 'lucide-react';
import { m } from '@/messages';

export const dynamic = 'force-static';

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <span className="bg-surface-2 text-muted flex size-20 items-center justify-center rounded-full">
        <WifiOff className="size-10" aria-hidden />
      </span>
      <h1 className="text-2xl font-extrabold">{m.common.offlineTryAgain}</h1>
    </main>
  );
}
