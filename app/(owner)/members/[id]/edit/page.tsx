import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Page, PageHeader } from '@/components/page-header';
import { getPlans, requireGym, signPhoto } from '@/lib/data';
import { m } from '@/messages';
import type { Member } from '@/lib/types';
import { MemberForm } from '../../member-form';

export const metadata: Metadata = { title: m.form.editTitle };

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, today } = await requireGym();
  const { data } = await supabase.from('members').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const member = data as Member;
  const plans = (await getPlans()).filter((p) => p.is_active || p.id === member.plan_id);
  return (
    <Page narrow>
      <PageHeader title={m.form.editTitle} back={{ href: `/members/${id}`, label: member.name }} />
      <MemberForm
        plans={plans}
        today={today}
        member={{
          id: member.id,
          name: member.name,
          phone: member.phone,
          planId: member.plan_id,
          note: member.note,
          photoUrl: await signPhoto(member.photo_path),
        }}
      />
    </Page>
  );
}
