import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { RETURNING_COOKIE } from '@/lib/cookies';
import { safeNext } from '@/lib/safe-next';

// Routes members and the kiosk tablet use. They never need an owner session,
// so we skip the auth round-trip entirely to keep check-in fast.
const OPEN = [/^\/m(\/|$)/, /^\/kiosk(\/|$)/, /^\/api\/(checkin|kiosk|m)(\/|$)/, /^\/offline$/];
// Pages for signed-out owners.
const GUEST = [/^\/login$/, /^\/signup$/, /^\/forgot-password$/, /^\/auth\//];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (OPEN.some((r) => r.test(pathname))) return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next(); // pages show a configuration error

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  // Refreshes the session cookie when needed. Do not run code between
  // createServerClient and getClaims.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const isGuestPage = GUEST.some((r) => r.test(pathname));

  if (!signedIn && !isGuestPage) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }
    // First visit from this browser: start with account creation. Returning owners get Sign in.
    const target = request.nextUrl.clone();
    target.pathname = request.cookies.has(RETURNING_COOKIE) ? '/login' : '/signup';
    target.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(target);
  }

  if (signedIn && (pathname === '/login' || pathname === '/signup')) {
    // Already signed in (e.g. another tab finished signing in): go where the link was headed.
    const redirect = NextResponse.redirect(new URL(safeNext(request.nextUrl.searchParams.get('next')), request.url));
    // Keep any session cookie getClaims just refreshed, or the next request would look signed out.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|favicon.png|icons/|sw.js|manifest.webmanifest|robots.txt|offline|.*\\.(?:png|jpg|jpeg|svg|webp|ico|woff2?)$).*)',
  ],
};
