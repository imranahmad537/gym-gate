const fmt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });

/** "Rs 2,500" */
export function formatRs(amount: number | null | undefined): string {
  return `Rs ${fmt.format(Math.round(amount ?? 0))}`;
}

/** "2,500" — for inputs */
export function groupDigits(amount: number): string {
  return fmt.format(Math.round(amount));
}

/** Parses "2,500" / "Rs 2500" into 2500. Returns null when empty or invalid. */
export function parseAmount(input: string | null | undefined): number | null {
  if (input == null) return null;
  const digits = String(input).replace(/[^\d]/g, '');
  if (!digits) return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}
