export const DEVICE_COOKIE = 'gg_device';
export const KIOSK_COOKIE = 'gg_kiosk';
export const THEME_COOKIE = 'gg_theme';
/** Set once this browser has signed in or signed up, so signed-out visits show Sign in instead of Create account. */
export const RETURNING_COOKIE = 'gg_returning';

/** Browsers cap cookie lifetime at 400 days. */
export const LONG_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export const secureCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: LONG_COOKIE_MAX_AGE,
};
