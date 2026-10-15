import type { Metadata } from 'next';
import { Tablet } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Page, PageHeader } from '@/components/page-header';
import { getMembers } from '@/lib/data';
import { m } from '@/messages';
import { ManualCheckin, StartKioskButton } from './manual';

export const metadata: Metadata = { title: m.checkinPage.title };

export default async function CheckinPage() {
  const members = await getMembers();
  return (
    <Page narrow>
      <PageHeader title={m.checkinPage.title} />
      <Card className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <span className="bg-primary-soft text-primary-ink flex size-11 items-center justify-center rounded-xl">
            <Tablet className="size-[22px]" aria-hidden />
          </span>
          <h2 className="text-lg font-extrabold">{m.checkinPage.kioskTitle}</h2>
        </div>
        <p className="text-muted text-[15px] leading-relaxed">{m.checkinPage.kioskBody}</p>
        <StartKioskButton />
        <p className="text-muted text-[13px] leading-relaxed font-semibold">{m.settings.startKioskHint}</p>
      </Card>
      <div className="mt-6">
        <h2 className="text-lg font-extrabold">{m.checkinPage.manualTitle}</h2>
        <p className="text-muted mb-3 text-sm">{m.checkinPage.manualBody}</p>
        <ManualCheckin
          members={members.map((x) => ({ id: x.id, no: x.member_no, name: x.name, digits: x.phone.replace(/\D/g, ''), photoUrl: x.photoUrl, fee: x.fee }))}
        />
      </div>
    </Page>
  );
}
