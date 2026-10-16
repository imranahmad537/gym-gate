import { m } from '@/messages';

type AuthErrorLike = { code?: string; status?: number; message?: string } | null | undefined;

/**
 * Turns a Supabase auth error into wording we control.
 * Supabase messages are developer-facing (e.g. "you can only request this after 42 seconds").
 */
export function authErrorMessage(error: AuthErrorLike): string {
  const code = error?.code ?? '';
  const msg = error?.message ?? '';
  if (code === 'invalid_credentials' || /invalid login credentials/i.test(msg)) return m.auth.badLogin;
  if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) return m.auth.checkEmail;
  if (code === 'user_already_exists' || code === 'email_exists' || /already (registered|exists)/i.test(msg)) return m.auth.accountExists;
  if (code === 'weak_password' || /password.*(weak|pwned|known)/i.test(msg)) return m.auth.weakPassword;
  if (code === 'same_password') return m.auth.samePassword;
  if (code === 'signup_disabled' || /signups not allowed/i.test(msg)) return m.auth.signupClosed;
  if (code === 'email_address_invalid' || code === 'validation_failed') return m.auth.invalidEmail;
  if (error?.status === 429 || code.startsWith('over_') || /rate limit|security purposes|too many/i.test(msg)) return m.auth.tooManyAttempts;
  if (/fetch failed|network|ECONN|ETIMEDOUT/i.test(msg)) return m.common.offlineTryAgain;
  console.error('[gymgate] auth failed', error);
  return m.common.somethingWrong;
}
