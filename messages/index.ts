import { en, type Messages } from './en';

// To add Urdu: create messages/ur.ts exporting `ur: Messages` (with dir: 'rtl'),
// add it below, and pick the locale from a cookie or the gym's settings.
const catalogs: Record<string, Messages> = { en };

export type Locale = 'en';

export function getMessages(locale: Locale = 'en'): Messages {
  return catalogs[locale] ?? en;
}

/** Default catalog for components. */
export const m = en;
export type { Messages };
