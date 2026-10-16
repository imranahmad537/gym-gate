const BASE = 'http://gymgate.invalid';

/**
 * Only allow redirects to our own paths.
 * Parses the way browsers do, so tricks like "/\evil.com" or "/\t/evil.com" (tabs are stripped) can't leave the site.
 */
export function safeNext(next: unknown): string {
  if (typeof next !== 'string' || !next.startsWith('/')) return '/';
  try {
    const url = new URL(next, BASE);
    if (url.origin !== BASE) return '/';
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}

/** First value of a search param (Next gives an array when a key repeats), capped to a sane length. */
export function firstParam(v: string | string[] | undefined, max = 500): string | undefined {
  const s = Array.isArray(v) ? v[0] : v;
  return s ? s.slice(0, max) : undefined;
}
