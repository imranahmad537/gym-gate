import type { Metadata } from 'next';
import { firstParam } from '@/lib/safe-next';
import { m } from '@/messages';
import { SignupForm } from '../forms';

export const metadata: Metadata = { title: m.auth.signupTitle };

// The form renders its own heading because it swaps to a "check your inbox" screen after submit.
export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const next = firstParam((await searchParams).next);
  return <SignupForm next={next} />;
}
