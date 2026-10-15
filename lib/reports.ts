import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { firstOfMonth, lastOfMonth } from '@/lib/dates';
import type { Payment } from '@/lib/types';

/** All payments in a month, paging past the API's 1000-row limit. */
export async function paymentsForMonth(supabase: SupabaseClient, month: string): Promise<Payment[]> {
  const out: Payment[] = [];
  const page = 1000;
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .gte('paid_on', firstOfMonth(month))
      .lte('paid_on', lastOfMonth(month))
      .order('paid_on', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + page - 1);
    if (error) throw error;
    out.push(...((data ?? []) as Payment[]));
    if (!data || data.length < page) break;
  }
  return out;
}

/** RFC 4180 CSV with a BOM so Excel opens Urdu/Unicode names correctly. */
export function toCsv(rows: (string | number | null | undefined)[][]): string {
  const esc = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    // Neutralise spreadsheet formulas in user-entered text.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n';
}
