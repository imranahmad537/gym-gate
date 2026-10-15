'use client';
import { TriangleAlert } from 'lucide-react';
import { useEffect } from 'react';
import { Button, ButtonLink } from '@/components/ui/button';
import { m } from '@/messages';

export default function OwnerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 pt-20 text-center">
      <span className="bg-bad-soft text-bad flex size-[72px] items-center justify-center rounded-full">
        <TriangleAlert className="size-9" aria-hidden />
      </span>
      <h1 className="text-2xl font-extrabold">{m.errors.title}</h1>
      <p className="text-muted text-[15px] leading-relaxed">{m.errors.body}</p>
      <Button size="lg" onClick={reset} className="w-full">
        {m.common.retry}
      </Button>
      <ButtonLink href="/" variant="secondary" size="lg" className="w-full">
        {m.errors.goHome}
      </ButtonLink>
    </main>
  );
}
