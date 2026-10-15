import type { Metadata } from 'next';
import { AuthHeading } from '@/components/auth-heading';
import { m } from '@/messages';
import { ResetForm } from '../forms';

export const metadata: Metadata = { title: m.auth.newPassword };

export default function ResetPasswordPage() {
  return (
    <>
      <AuthHeading title={m.auth.newPassword} />
      <ResetForm />
    </>
  );
}
