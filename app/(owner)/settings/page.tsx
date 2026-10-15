import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Page, PageHeader } from '@/components/page-header';
import { getMembers, getPlans, requireGym } from '@/lib/data';
import { dateInTz, formatDate } from '@/lib/dates';
import { THEME_COOKIE } from '@/lib/cookies';
import { m } from '@/messages';
import { AccountSection, GymSection, KioskSection, PlansSection, SecuritySection, ThemeSection } from './sections';

export const metadata: Metadata = { title: m.settings.title };

export default async function SettingsPage() {
  const { supabase, gym, user } = await requireGym();
  const [plans, members, kiosksRes] = await Promise.all([
    getPlans(),
    getMembers(),
    supabase.from('kiosks').select('id, name, last_seen_at, created_at').is('revoked_at', null).order('created_at'),
  ]);
  const counts = new Map<string, number>();
  for (const x of members) if (x.plan_id) counts.set(x.plan_id, (counts.get(x.plan_id) ?? 0) + 1);
  const theme = (await cookies()).get(THEME_COOKIE)?.value;

  return (
    <Page narrow>
      <PageHeader title={m.settings.title} />
      <div className="flex flex-col gap-6 pb-6">
        <PlansSection
          plans={plans.map((p) => ({ id: p.id, name: p.name, days: p.duration_days, price: p.price, active: p.is_active, members: counts.get(p.id) ?? 0 }))}
        />
        <KioskSection
          settings={{ qrIntervalSecs: gym.qr_interval_secs, resultSecs: gym.result_secs, keypadEnabled: gym.keypad_enabled }}
          kiosks={((kiosksRes.data ?? []) as { id: string; name: string; last_seen_at: string | null }[]).map((k) => ({
            id: k.id,
            name: k.name,
            lastSeen: k.last_seen_at ? formatDate(dateInTz(k.last_seen_at, gym.timezone)) : null,
          }))}
        />
        <SecuritySection settings={{ requirePasskey: gym.require_passkey, oneDevicePerMember: gym.one_device_per_member }} />
        <GymSection gym={{ name: gym.name, phone: gym.phone ?? '' }} />
        <ThemeSection theme={theme === 'light' || theme === 'dark' ? theme : 'system'} />
        <AccountSection email={user.email ?? ''} />
      </div>
    </Page>
  );
}
