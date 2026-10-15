'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { appOrigin } from '@/lib/origin';
import { hashPin } from '@/lib/crypto';
import { toError } from '@/lib/action';
import { m } from '@/messages';

export type FormState = { error?: string; message?: string } | null;

const credentials = z.object({
  email: z.email('Enter a valid email.'),
  password: z.string().min(8, m.auth.passwordHint),
});

/** Only allow redirects to our own paths. */
function safeNext(next: FormDataEntryValue | null): string {
  const v = typeof next === 'string' ? next : '';
  return v.startsWith('/') && !v.startsWith('//') && !v.startsWith('/\\') ? v : '/';
}

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return { error: m.auth.badLogin };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/confirm/i.test(error.message)) return { error: m.auth.checkEmail };
    if (/invalid/i.test(error.message)) return { error: m.auth.badLogin };
    return toError(error);
  }
  redirect(safeNext(form.get('next')));
}

export async function signupAction(_: FormState, form: FormData): Promise<FormState> {
  const parsed = credentials.safeParse({ email: form.get('email'), password: form.get('password') });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${await appOrigin()}/auth/callback?next=/setup` },
  });
  if (error) return { error: error.message };
  if (data.session) redirect('/setup');
  return { message: m.auth.checkEmail };
}

export async function forgotPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const email = z.email().safeParse(form.get('email'));
  if (!email.success) return { error: 'Enter a valid email.' };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${await appOrigin()}/auth/callback?next=/reset-password`,
  });
  // Same answer whether or not the email exists.
  return { message: m.auth.linkSent };
}

export async function resetPasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const password = z.string().min(8, m.auth.passwordHint).safeParse(form.get('password'));
  if (!password.success) return { error: m.auth.passwordHint };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) return { error: error.message };
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
  redirect('/');
}
