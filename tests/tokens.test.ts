import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
process.env.APP_SECRET = 'x'.repeat(40);
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'a'.repeat(40);
process.env.SUPABASE_SERVICE_ROLE_KEY = 's'.repeat(40);

const { signKioskToken, verifyKioskToken, windowFor } = await import('@/lib/kiosk-token');
const { signKioskTokenBrowser } = await import('@/lib/kiosk-token-browser');
const { signTicket, verifyTicket } = await import('@/lib/ticket');
const { hashPin, verifyPin, activationCode, normalizeActivationCode } = await import('@/lib/crypto');

describe('kiosk QR tokens', () => {
  const secret = 'f'.repeat(64);
  const kioskId = '7a1c3a4e-6a51-4f1c-9a43-3c3c1f2a9b10';
  const now = Date.parse('2026-10-10T10:00:05Z');
  const w = windowFor(now, 20);

  it('browser and server sign identically', async () => {
    expect(await signKioskTokenBrowser(secret, kioskId, w)).toBe(signKioskToken(secret, kioskId, w));
  });

  it('accepts the current and neighbouring windows only', () => {
    const token = signKioskToken(secret, kioskId, w);
    expect(verifyKioskToken({ secret, kioskId, window: w, token, intervalSecs: 20, nowMs: now })).toBe('ok');
    expect(verifyKioskToken({ secret, kioskId, window: w, token, intervalSecs: 20, nowMs: now + 20_000 })).toBe('ok');
    expect(verifyKioskToken({ secret, kioskId, window: w, token, intervalSecs: 20, nowMs: now + 45_000 })).toBe('expired');
  });

  it('rejects forged or cross-kiosk tokens', () => {
    const token = signKioskToken(secret, kioskId, w);
    expect(verifyKioskToken({ secret: 'e'.repeat(64), kioskId, window: w, token, intervalSecs: 20, nowMs: now })).toBe('invalid');
    expect(verifyKioskToken({ secret, kioskId: 'other', window: w, token, intervalSecs: 20, nowMs: now })).toBe('invalid');
    expect(verifyKioskToken({ secret, kioskId, window: w + 1, token, intervalSecs: 20, nowMs: now })).toBe('invalid');
    expect(verifyKioskToken({ secret, kioskId, window: w, token: 'short', intervalSecs: 20, nowMs: now })).toBe('invalid');
  });
});

describe('signed tickets', () => {
  it('round-trips and rejects tampering', () => {
    const t = signTicket({ d: 'device', k: 'kiosk' }, 60);
    expect(verifyTicket<{ d: string }>(t)?.d).toBe('device');
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ d: 'other', k: 'kiosk', exp: 9999999999 })).toString('base64url');
    expect(verifyTicket(`${forged}.${sig}`)).toBeNull();
    expect(verifyTicket(`${body}.x${sig.slice(1)}`)).toBeNull();
  });
  it('expires', () => {
    expect(verifyTicket(signTicket({ a: 1 }, -1))).toBeNull();
  });
});

describe('PINs and activation codes', () => {
  it('hashes and verifies PINs', async () => {
    const h = await hashPin('1234');
    expect(h.startsWith('scrypt$')).toBe(true);
    expect(await verifyPin('1234', h)).toBe(true);
    expect(await verifyPin('4321', h)).toBe(false);
    expect(await verifyPin('1234', null)).toBe(false);
  });
  it('makes readable activation codes', () => {
    const code = activationCode();
    expect(code).toMatch(/^[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/);
    expect(normalizeActivationCode(code.toLowerCase())).toBe(code.replace(/-/g, ''));
  });
});
