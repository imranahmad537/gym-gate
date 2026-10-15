import { ButtonLink } from '@/components/ui/button';
import { m } from '@/messages';

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 pt-24 text-center">
      <div className="text-primary-ink text-6xl font-extrabold">404</div>
      <h1 className="text-2xl font-extrabold">{m.errors.notFoundTitle}</h1>
      <p className="text-muted text-[15px]">{m.errors.notFoundBody}</p>
      <ButtonLink href="/" size="lg" className="w-full">
        {m.errors.goHome}
      </ButtonLink>
    </main>
  );
}
