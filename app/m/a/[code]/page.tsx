import { redirect } from 'next/navigation';
import { Clock, Smartphone } from 'lucide-react';
import { createAdminClient } from '@/lib/supabase/server';
import { normalizeActivationCode, sha256 } from '@/lib/crypto';
import { lookupDevice } from '@/lib/device-auth';
import { signPhoto } from '@/lib/data';
import { displayPhone } from '@/lib/phone';
import { firstName } from '@/lib/whatsapp';
import { avatarColor, initials } from '@/lib/avatar';
import { SubmitButton } from '@/components/submit-button';
import { m } from '@/messages';
import type { Member } from '@/lib/types';
import { PhoneShell, StatusScreen } from '../../ui';
import { RequestSwitchButton } from '../../request-button';
import { activateAction } from './actions';

export const dynamic = 'force-dynamic';

function isPast(iso: string) {
  return Date.parse(iso) < Date.now();
}

export default async function ActivatePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const admin = createAdminClient();
  const { data: act } = await admin
    .from('activations')
    .select('id, gym_id, member_id, expires_at, used_at')
    .eq('code_hash', sha256(normalizeActivationCode(code)))
    .maybeSingle();

  const [{ data: gym }, { data: memberRow }] = act
    ? await Promise.all([admin.from('gyms').select('name').eq('id', act.gym_id).single(), admin.from('members').select('*').eq('id', act.member_id).single()])
    : [{ data: null }, { data: null }];
  const member = memberRow as Member | null;
  const gymName = (gym?.name as string | undefined) ?? null;

  if (!act || !member) {
    return (
      <PhoneShell gymName={gymName}>
        <StatusScreen icon={<Clock className="size-14" aria-hidden />} tone="warn" title={m.phone.linkExpiredTitle} body={m.phone.linkExpiredBody} />
      </PhoneShell>
    );
  }
  if (member.archived_at) {
    return (
      <PhoneShell gymName={gymName}>
        <StatusScreen icon={<Smartphone className="size-14" aria-hidden />} title={m.phone.archivedTitle} body={m.phone.archivedBody} />
      </PhoneShell>
    );
  }

  const device = await lookupDevice();
  if (device.state === 'active' && device.device.member_id === member.id) redirect('/m');

  // Expired links never offer the switch request; the front desk sends a fresh link instead.
  if (act.used_at && !isPast(act.expires_at)) {
    const { count } = await admin.from('devices').select('id', { count: 'exact', head: true }).eq('member_id', member.id).is('revoked_at', null);
    if ((count ?? 0) > 0) {
      return (
        <PhoneShell gymName={gymName}>
          <StatusScreen icon={<Smartphone className="size-14" aria-hidden />} tone="warn" title={m.phone.otherDeviceTitle} body={m.phone.otherDeviceBody}>
            <RequestSwitchButton code={code} />
          </StatusScreen>
        </PhoneShell>
      );
    }
  }
  if (act.used_at || isPast(act.expires_at)) {
    return (
      <PhoneShell gymName={gymName}>
        <StatusScreen icon={<Clock className="size-14" aria-hidden />} tone="warn" title={m.phone.linkExpiredTitle} body={m.phone.linkExpiredBody} />
      </PhoneShell>
    );
  }

  const first = firstName(member.name);
  const photo = await signPhoto(member.photo_path, 15 * 60);
  return (
    <PhoneShell gymName={gymName}>
      <div className="flex flex-1 flex-col gap-5 px-5 pt-2 pb-6">
        <h1 className="text-[28px] leading-tight font-extrabold">{m.phone.activateTitle(first)}</h1>
        <div className="border-line bg-surface flex flex-col items-center gap-2.5 rounded-[24px] border p-6">
          {photo ? (
            <img src={photo} alt="" className="size-[132px] rounded-full object-cover" />
          ) : (
            <span
              className="flex size-[132px] items-center justify-center rounded-full text-5xl font-extrabold text-white"
              style={{ background: avatarColor(member.member_no) }}
            >
              {initials(member.name)}
            </span>
          )}
          <div className="text-[22px] font-extrabold">{member.name}</div>
          <div className="text-muted text-[15px] font-semibold">{m.phone.memberLine(member.member_no, displayPhone(member.phone))}</div>
        </div>
        <p className="text-muted text-base leading-relaxed">{m.phone.isThisYou}</p>
        <div className="flex-1" />
        <form action={activateAction.bind(null, code)}>
          <SubmitButton size="lg" className="min-h-16 w-full text-[19px]">
            {m.phone.activate}
          </SubmitButton>
        </form>
        <p className="text-muted text-center text-sm font-semibold">{m.phone.notYou(first)}</p>
      </div>
    </PhoneShell>
  );
}
