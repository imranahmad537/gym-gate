import type { Metadata } from 'next';
import { AuthHeading } from '@/components/auth-heading';
import { m } from '@/messages';
import { LoginForm } from '../forms';

export const metadata: Metadata = { title: m.auth.loginTitle };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <>
      <AuthHeading title={m.auth.loginTitle} subtitle={m.auth.loginSubtitle} />
      <LoginForm next={next} />
    </>
  );
}
