import { NextResponse, type NextRequest } from 'next/server';
import type { EmailOtpType } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { RETURNING_COOKIE, secureCookie } from '@/lib/cookies';
import { safeNext } from '@/lib/safe-next';

// Handles links from Supabase emails (confirm signup, reset password).
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = safeNext(url.searchParams.get('next'));
  const supabase = await createClient();

  const code = url.searchParams.get('code');
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') as EmailOtpType | null;

  let ok = false;
  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  // `next` may carry its own query (e.g. /setup?next=/members), so resolve it as a URL.
  // A failed link (expired, already used, or opened in a different browser than the one that signed up) lands on
  // Sign in with an explanation. The email is often confirmed anyway, so signing in usually just works.
  const response = NextResponse.redirect(new URL(ok ? next : '/login?error=link', url.origin));
  if (ok) response.cookies.set(RETURNING_COOKIE, '1', secureCookie);
  return response;
}
