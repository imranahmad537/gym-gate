import { headers } from 'next/headers';
import { ScanLine, Smartphone } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/server';
import { lookupDevice } from '@/lib/device-auth';
import { visitsThisMonth, loadMemberWithPlan } from '@/lib/checkin';
import { buildCheckinResult } from '@/lib/checkin-result';
import { signPhoto } from '@/lib/data';
import { todayInTz } from '@/lib/dates';
import { m } from '@/messages';
import type { Gym } from '@/lib/types';
import { CheckinResultView, PhoneShell, StatusScreen } from './ui';
import { RequestSwitchButton } from './request-button';

export const dynamic = 'force-dynamic';

/** The member's pass: shows their plan, and the one-time "activated" welcome. */
export default async function PassPage({ searchParams }: { searchParams: Promise<{ activated?: string }> }) {
  const { activated } = await searchParams;
  const device = await lookupDevice();

  if (device.state === 'none' || device.state === 'unknown') {
    return (
      <PhoneShell>
        <StatusScreen icon={<Smartphone className="size-14" aria-hidden />} title={m.phone.unregisteredTitle} body={m.phone.unregisteredBody} />
      </PhoneShell>
    );
  }

  const admin = createAdminClient();
  const { data: gymRow } = await admin.from('gyms').select('*').eq('id', device.device.gym_id).single();
  const gym = gymRow as Gym;

  if (device.state === 'revoked') {
    return (
      <PhoneShell gymName={gym.name}>
        <StatusScreen icon={<Smartphone className="size-14" aria-hidden />} tone="warn" title={m.phone.otherDeviceTitle} body={m.phone.otherDeviceBody}>
          <RequestSwitchButton />
        </StatusScreen>
      </PhoneShell>
    );
  }

  const loaded = await loadMemberWithPlan(admin, gym.id, device.device.member_id);
  if (!loaded || loaded.member.archived_at) {
    return (
      <PhoneShell gymName={gym.name}>
        <StatusScreen icon={<Smartphone className="size-14" aria-hidden />} title={m.phone.archivedTitle} body={m.phone.archivedBody} />
      </PhoneShell>
    );
  }
  const { member, plan } = loaded;
  const [visits, photoUrl] = await Promise.all([visitsThisMonth(admin, gym, member.id), signPhoto(member.photo_path, 15 * 60)]);
  const today = todayInTz(gym.timezone);
  const pass = buildCheckinResult({
    checkinId: 'pass',
    member: {
      id: member.id,
      no: member.member_no,
      name: member.name,
      photoUrl,
      validTill: member.valid_till,
      planName: plan?.name ?? null,
      planPrice: plan?.price ?? null,
      planDays: plan?.duration_days ?? null,
    },
    visitsThisMonth: visits,
    method: 'phone',
    at: new Date().toISOString(),
    today,
  });
  const ua = (await headers()).get('user-agent') ?? '';
  const ios = /iPhone|iPad/i.test(ua);

  return (
    <PhoneShell gymName={gym.name}>
      {activated === '1' && (
        <div className="bg-ok-soft text-ok mx-4 mb-4 flex flex-col gap-2 rounded-[22px] p-[18px]">
          <div className="text-xl font-extrabold">{m.phone.activatedTitle}</div>
          <div className="text-[15px] font-semibold">{m.phone.activatedBody}</div>
          <div className="bg-surface text-ink mt-1 rounded-xl p-3 text-sm leading-relaxed">
            <span className="font-extrabold">{m.phone.homeTipTitle}. </span>
            {ios ? m.phone.iosTip : m.phone.homeTipBody}
          </div>
        </div>
      )}
      <div className="border-line bg-surface mx-4 mb-3 flex items-center gap-3 rounded-[22px] border p-4">
        <span className="bg-primary-soft text-primary-ink flex size-11 shrink-0 items-center justify-center rounded-xl">
          <ScanLine className="size-6" aria-hidden />
        </span>
        <div>
          <div className="text-base font-extrabold">{m.phone.passTitle}</div>
          <div className="text-muted text-sm">{m.phone.howTo}</div>
        </div>
      </div>
      <CheckinResultView result={pass} tz={gym.timezone} compact />
    </PhoneShell>
  );
}
