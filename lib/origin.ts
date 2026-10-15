import 'server-only';
import { headers } from 'next/headers';
import { env } from '@/lib/env';

/** Public origin of the app, e.g. "https://gymgate.pk". Prefers APP_URL. */
export async function appOrigin(): Promise<string> {
  const configured = env().APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host') ?? 'localhost:3000';
  const proto = h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}
