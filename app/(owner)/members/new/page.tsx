import type { Metadata } from 'next';
import { Page, PageHeader } from '@/components/page-header';
import { getPlans, requireGym } from '@/lib/data';
import { m } from '@/messages';
import { MemberForm } from '../member-form';

export const metadata: Metadata = { title: m.form.newTitle };

export default async function NewMemberPage() {
  const { today } = await requireGym();
  const plans = (await getPlans()).filter((p) => p.is_active);
  return (
    <Page narrow>
      <PageHeader title={m.form.newTitle} back={{ href: '/members', label: m.nav.members }} />
      <MemberForm plans={plans} today={today} />
    </Page>
  );
}
