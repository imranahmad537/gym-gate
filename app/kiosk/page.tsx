import type { Metadata, Viewport } from 'next';
import { Tablet } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { createAdminClient } from '@/lib/supabase/server';
import { getKioskSession } from '@/lib/kiosk-auth';
import { buildKioskState } from '@/lib/kiosk-snapshot';
import { m } from '@/messages';
import { KioskClient } from './kiosk-client';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: m.nav.checkin, robots: { index: false } };
export const viewport: Viewport = { themeColor: '#0b130f' };

export default async function KioskPage() {
  const session = await getKioskSession();
  if (!session) {
    return (
      <main data-theme="dark" className="bg-bg text-ink flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
        <span className="bg-surface-2 flex size-20 items-center justify-center rounded-full">
          <Tablet className="size-10" aria-hidden />
        </span>
        <h1 className="text-3xl font-extrabold">{m.kiosk.notPairedTitle}</h1>
        <p className="text-muted max-w-lg text-lg">{m.kiosk.notPairedBody}</p>
        <ButtonLink href="/login?next=/settings" size="lg">
          {m.kiosk.signIn}
        </ButtonLink>
      </main>
    );
  }
  const admin = createAdminClient();
  const state = await buildKioskState(admin, session.gym, session.kiosk);
  await admin.from('kiosks').update({ last_seen_at: new Date().toISOString() }).eq('id', session.kiosk.id);
  return <KioskClient initial={state} dev={process.env.NODE_ENV !== 'production'} />;
}
