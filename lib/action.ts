import { m } from '@/messages';

export type ActionResult<T extends object = object> = ({ ok: true } & T) | { ok: false; error: string; fields?: Record<string, string> };

/** An error whose message is safe to show the owner. */
export class UserError extends Error {}

const KNOWN: Record<string, string> = {
  member_not_found: m.member.notFound,
  plan_required: m.form.errors.plan,
  not_latest_payment: 'Only the most recent payment can be deleted.',
  payment_not_found: 'This payment was already deleted.',
  request_not_found: 'This request was already handled.',
  gym_exists: 'You already have a gym.',
};

/** Turns any thrown error into a safe, readable message. Logs the original. */
export function toError(err: unknown): { ok: false; error: string } {
  if (err instanceof UserError) return { ok: false, error: err.message };
  const msg = err instanceof Error ? err.message : typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : '';
  for (const [code, text] of Object.entries(KNOWN)) {
    if (msg.includes(code)) return { ok: false, error: text };
  }
  if (/fetch failed|network|ECONN|ETIMEDOUT/i.test(msg)) return { ok: false, error: m.common.offlineTryAgain };
  console.error('[gymgate] action failed', err);
  return { ok: false, error: m.common.somethingWrong };
}
