'use server';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { RETURNING_COOKIE, secureCookie } from '@/lib/cookies';
import { createClient } from '@/lib/supabase/server';
import { appOrigin } from '@/lib/origin';
import { hashPin } from '@/lib/crypto';
import { toError } from '@/lib/action';
import { authErrorMessage } from '@/lib/auth-errors';
import { safeNext } from '@/lib/safe-next';
import { m } from '@/messages';

export type FormState = {
  error?: string;
  message?: string;
  /** Echoed back so the form keeps what the owner typed. */
  email?: string;
  /** Set when signup hit an existing account, so the form can offer Sign in. */
  accountExists?: boolean;
  /** Set when sign-in failed because the email is not confirmed yet, so the form can offer a resend. */
  unconfirmed?: boolean;
  /** Set after signup when a confirmation email is on its way. */
  sentTo?: string;
} | null;

const credentials = z.object({
  email: z.email(m.auth.invalidEmail),
  password: z.string().min(8, m.auth.passwordHint),
});

function emailOf(form: FormData): string {
  const v = form.get('email');
  return typeof v === 'string' ? v.trim() : '';
}

async function rememberReturning() {
  (await cookies()).set(RETURNING_COOKIE, '1', secureCookie);
}

/** Setup first, then the page the owner originally asked for. */
function setupPath(next: string): string {
  // Setup itself (or a page under it) as the target would just bounce back to setup.
  return next === '/' || next.startsWith('/setup') ? '/setup' : `/setup?next=${encodeURIComponent(next)}`;
}

async function confirmRedirect(next: string): Promise<string> {
  return `${await appOrigin()}/auth/callback?next=${encodeURIComponent(setupPath(next))}`;
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const email = emailOf(form);
  const parsed = credentials.safeParse({ email, password: form.get('password') });
  if (!parsed.success) return { error: m.auth.badLogin, email };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    const message = authErrorMessage(error);
    return { error: message, email, unconfirmed: message === m.auth.checkEmail };
  }
  await rememberReturning();
  redirect(safeNext(form.get('next')));
}

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const email = emailOf(form);
  const next = safeNext(form.get('next'));
  const parsed = credentials.safeParse({ email, password: form.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message, email };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: await confirmRedirect(next) },
  });
  if (error) {
    const message = authErrorMessage(error);
    return { error: message, email, accountExists: message === m.auth.accountExists };
  }
  // With email confirmation on, Supabase hides existing accounts by returning a user with no identities.
  if (data.user && data.user.identities?.length === 0) return { error: m.auth.accountExists, email, accountExists: true };
  // From now on this browser is a returning owner, so a later signed-out visit shows Sign in.
  await rememberReturning();
  if (data.session) redirect(setupPath(next));
  return { sentTo: parsed.data.email };
}

export async function resendConfirmationAction(_: FormState, form: FormData): Promise<FormState> {
  const email = z.email().safeParse(emailOf(form));
  if (!email.success) return { error: m.auth.invalidEmail };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email: email.data,
    options: { emailRedirectTo: await confirmRedirect(safeNext(form.get('next'))) },
  });
  if (error) return { error: authErrorMessage(error), email: email.data };
  return { message: m.auth.resent, email: email.data };
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const email = emailOf(form);
  const parsed = z.email().safeParse(email);
  if (!parsed.success) return { error: m.auth.invalidEmail, email };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${await appOrigin()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the email exists.
  return { message: m.auth.linkSent, email };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const password = z.string().min(8, m.auth.passwordHint).safeParse(form.get('password'));
  if (!password.success) return { error: m.auth.passwordHint };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: authErrorMessage(error) };
  redirect('/');
}

const setupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your gym name.').max(80),
  phone: z.string().trim().max(30).optional().default(''),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be 4 digits.'),
});

export async function createGymAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = setupSchema.safeParse({ name: form.get('name'), phone: form.get('phone') ?? '', pin: form.get('pin') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const { error } = await supabase.rpc('create_gym', {
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_pin_hash: await hashPin(parsed.data.pin),
  });
  if (error && !error.message.includes('gym_exists')) return toError(error);
  redirect(safeNext(form.get('next')));
}
