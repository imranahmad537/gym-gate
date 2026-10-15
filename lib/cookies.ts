export const DEVICE_COOKIE = 'gg_device';
export const KIOSK_COOKIE = 'gg_kiosk';
export const THEME_COOKIE = 'gg_theme';

/** Browsers cap cookie lifetime at 400 days. */
export const LONG_COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

export const secureCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: LONG_COOKIE_MAX_AGE,
};
