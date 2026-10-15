import type { Metadata } from 'next';
import { AuthHeading } from '@/components/auth-heading';
import { m } from '@/messages';
import { SignupForm } from '../forms';

export const metadata: Metadata = { title: m.auth.signupTitle };

export default function SignupPage() {
  return (
    <>
      <AuthHeading title={m.auth.signupTitle} subtitle={m.auth.signupSubtitle} />
      <SignupForm />
    </>
  );
}
