import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthHeading } from '@/components/auth-heading';
import { getOwner } from '@/lib/data';
import { firstParam } from '@/lib/safe-next';
import { m } from '@/messages';
import { SetupForm } from '../forms';

export const metadata: Metadata = { title: m.setup.title };

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = firstParam((await searchParams).next);
  const owner = await getOwner();
  if (!owner) redirect('/login');
  if (owner.gym) redirect('/');
  return (
    <>
      <AuthHeading title={m.setup.title} subtitle={m.setup.subtitle} />
      <SetupForm next={next} />
    </>
  );
}
