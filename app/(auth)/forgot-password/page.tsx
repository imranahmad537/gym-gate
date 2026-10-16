import type { Metadata } from 'next';
import { AuthHeading } from '@/components/auth-heading';
import { firstParam } from '@/lib/safe-next';
import { m } from '@/messages';
import { ForgotForm } from '../forms';

export const metadata: Metadata = { title: m.auth.forgotTitle };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ email?: string | string[] }> }) {
  const email = firstParam((await searchParams).email, 254);
  return (
    <>
      <AuthHeading title={m.auth.forgotTitle} subtitle={m.auth.forgotSubtitle} />
      <ForgotForm email={email} />
    </>
  );
}
