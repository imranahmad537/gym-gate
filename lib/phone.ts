/**
 * Normalises a Pakistani mobile number to E.164 (+923001234567).
 * Accepts "0300 1234567", "300-1234567", "+92 300 1234567", "923001234567".
 * Returns null if it is not a valid mobile number.
 */
export function normalizePkMobile(input: string | null | undefined): string | null {
  if (!input) return null;
  let d = String(input).replace(/[^\d]/g, '');
  if (d.startsWith('0092')) d = d.slice(4);
  else if (d.startsWith('92') && d.length === 12) d = d.slice(2);
  else if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  if (!/^3\d{9}$/.test(d)) return null;
  return `+92${d}`;
}

/** "+923001234567" → "0300-1234567" */
export function displayPhone(e164: string): string {
  const d = e164.replace(/^\+92/, '');
  if (d.length !== 10) return e164;
  return `0${d.slice(0, 3)}-${d.slice(3)}`;
}

/** "+923001234567" → "923001234567" for wa.me links */
export function waNumber(e164: string): string {
  return e164.replace(/^\+/, '');
}

export function last4(e164: string): string {
  return e164.slice(-4);
}
