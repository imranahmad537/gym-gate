import type { Metadata } from 'next';
import { AuthHeading } from '@/components/auth-heading';
import { m } from '@/messages';
import { ForgotForm } from '../forms';

export const metadata: Metadata = { title: m.auth.forgotTitle };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title={m.auth.forgotTitle} subtitle={m.auth.forgotSubtitle} />
      <ForgotForm />
    </>
  );
}
