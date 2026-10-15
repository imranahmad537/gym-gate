// Rotating kiosk QR tokens. The kiosk signs `${kioskId}.${window}` with its
// secret using HMAC-SHA256 (see kiosk-token-browser.ts for the browser side,
// which must produce identical output). The server accepts the current window
// plus one either side to absorb small clock drift and scans right at a
// rollover.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const TOKEN_LENGTH = 22; // base64url chars ≈ 132 bits

export function windowFor(nowMs: number, intervalSecs: number): number {
  return Math.floor(nowMs / (intervalSecs * 1000));
}

export function signKioskToken(secret: string, kioskId: string, window: number): string {
  return createHmac('sha256', secret).update(`${kioskId}.${window}`).digest('base64url').slice(0, TOKEN_LENGTH);
}

export type TokenCheck = 'ok' | 'expired' | 'invalid';

export function verifyKioskToken(opts: { secret: string; kioskId: string; window: number; token: string; intervalSecs: number; nowMs?: number }): TokenCheck {
  const { secret, kioskId, window, token, intervalSecs } = opts;
  if (!Number.isSafeInteger(window) || typeof token !== 'string' || token.length !== TOKEN_LENGTH) return 'invalid';
  const expected = Buffer.from(signKioskToken(secret, kioskId, window));
  const given = Buffer.from(token);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return 'invalid';
  const now = windowFor(opts.nowMs ?? Date.now(), intervalSecs);
  return Math.abs(now - window) <= 1 ? 'ok' : 'expired';
}
