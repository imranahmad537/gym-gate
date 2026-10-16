import type { Metadata } from 'next';
import { AuthHeading } from '@/components/auth-heading';
import { firstParam } from '@/lib/safe-next';
import { m } from '@/messages';
import { LoginForm } from '../forms';

export const metadata: Metadata = { title: m.auth.loginTitle };

type Params = { next?: string | string[]; email?: string | string[]; error?: string | string[] };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  return (
    <>
      <AuthHeading title={m.auth.loginTitle} subtitle={m.auth.loginSubtitle} />
      <LoginForm
        next={firstParam(params.next)}
        email={firstParam(params.email, 254)}
        notice={firstParam(params.error) === 'link' ? m.auth.linkInvalid : undefined}
      />
    </>
  );
}
