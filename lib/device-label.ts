/** Rough, human-friendly phone name from a user agent, e.g. "Android · SM-A546E" or "iPhone". */
export function deviceLabel(ua: string | null | undefined): string {
  if (!ua) return 'Phone';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  const android = ua.match(/Android [\d.]+;\s*([^;)]+?)(?:\s+Build|\)|;)/i);
  if (android) {
    const model = android[1].trim();
    if (model && model !== 'K' && !/^wv$/i.test(model)) return `Android · ${model}`;
    return 'Android phone';
  }
  if (/Android/i.test(ua)) return 'Android phone';
  return 'Phone';
}
