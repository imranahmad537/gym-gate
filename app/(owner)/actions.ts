'use server';
import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { requireGym, PHOTO_BUCKET } from '@/lib/data';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { activationCode, hashPin, normalizeActivationCode, randomSecret, sha256 } from '@/lib/crypto';
import { appOrigin } from '@/lib/origin';
import { firstName, waLink } from '@/lib/whatsapp';
import { KIOSK_COOKIE, THEME_COOKIE, secureCookie } from '@/lib/cookies';
import { performCheckin } from '@/lib/checkin';
import { toError, UserError, type ActionResult } from '@/lib/action';
import {
  fieldErrors,
  firstError,
  gymSchema,
  kioskSettingsSchema,
  memberCreateSchema,
  memberUpdateSchema,
  paymentSchema,
  pinSchema,
  planSchema,
  securitySchema,
} from '@/lib/validation';
import { m } from '@/messages';
import type { Member, PaymentMethod } from '@/lib/types';

const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const ACTIVATION_TTL_DAYS = 7;

function refresh() {
  revalidatePath('/', 'layout');
}

async function uploadPhoto(gymId: string, file: FormDataEntryValue | null): Promise<string | null> {
  if (!file || typeof file === 'string' || file.size === 0) return null;
  const ext = PHOTO_TYPES[file.type];
  if (!ext || file.size > 1024 * 1024) throw new UserError(m.form.errors.photo);
  const path = `${gymId}/${randomUUID()}.${ext}`;
  const { error } = await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false, cacheControl: '31536000' });
  if (error) throw error;
  return path;
}

async function removePhoto(path: string | null | undefined) {
  if (!path) return;
  await createAdminClient()
    .storage.from(PHOTO_BUCKET)
    .remove([path])
    .catch(() => {});
}

type OwnerClient = Awaited<ReturnType<typeof requireGym>>['supabase'];

/** Creates a one-time activation code and the WhatsApp link that sends it. */
async function issueActivation(supabase: OwnerClient, gym: { id: string; name: string }, member: { id: string; name: string; phone: string }) {
  const code = activationCode();
  const { error } = await supabase.from('activations').insert({
    gym_id: gym.id,
    member_id: member.id,
    code_hash: sha256(normalizeActivationCode(code)),
    expires_at: new Date(Date.now() + ACTIVATION_TTL_DAYS * 86_400_000).toISOString(),
  });
  if (error) throw error;
  const link = `${await appOrigin()}/m/a/${code}`;
  return { link, waUrl: waLink(member.phone, m.whatsapp.activation(firstName(member.name), gym.name, link)) };
}

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export async function createMemberAction(form: FormData): Promise<ActionResult<{ id: string; memberNo: number; name: string; waUrl: string }>> {
  try {
    const { supabase, gym } = await requireGym();
    const parsed = memberCreateSchema.safeParse({
      name: form.get('name'),
      phone: form.get('phone'),
      planId: form.get('planId'),
      start: form.get('start'),
      amount: form.get('amount'),
      method: form.get('method') || 'cash',
      note: form.get('note') || undefined,
    });
    if (!parsed.success) return { ok: false, error: firstError(parsed.error), fields: fieldErrors(parsed.error) };
    const d = parsed.data;
    const photoPath = await uploadPhoto(gym.id, form.get('photo'));
    const { data, error } = await supabase.rpc('create_member', {
      p_name: d.name,
      p_phone: d.phone,
      p_plan_id: d.planId,
      p_start: d.start,
      p_amount: d.amount,
      p_method: d.method,
      p_note: d.note,
      p_photo_path: photoPath,
    });
    if (error) {
      await removePhoto(photoPath);
      throw error;
    }
    const member = (Array.isArray(data) ? data[0] : data) as Member;
    const { waUrl } = await issueActivation(supabase, gym, member);
    refresh();
    return { ok: true, id: member.id, memberNo: member.member_no, name: member.name, waUrl };
  } catch (err) {
    return toError(err);
  }
}

export async function updateMemberAction(memberId: string, form: FormData): Promise<ActionResult> {
  try {
    const { supabase, gym } = await requireGym();
    const parsed = memberUpdateSchema.safeParse({
      name: form.get('name'),
      phone: form.get('phone'),
      planId: form.get('planId'),
      note: form.get('note') || undefined,
    });
    if (!parsed.success) return { ok: false, error: firstError(parsed.error), fields: fieldErrors(parsed.error) };
    const { data: current } = await supabase.from('members').select('photo_path').eq('id', memberId).maybeSingle();
    if (!current) throw new UserError(m.member.notFound);
    const photoPath = await uploadPhoto(gym.id, form.get('photo'));
    const { error } = await supabase
      .from('members')
      .update({
        name: parsed.data.name,
        phone: parsed.data.phone,
        plan_id: parsed.data.planId,
        note: parsed.data.note,
        ...(photoPath ? { photo_path: photoPath } : {}),
      })
      .eq('id', memberId);
    if (error) {
      await removePhoto(photoPath);
      throw error;
    }
    if (photoPath) await removePhoto(current.photo_path);
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function setArchivedAction(memberId: string, archived: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireGym();
    const { error } = await supabase
      .from('members')
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq('id', memberId);
    if (error) throw error;
    if (archived) {
      await supabase.from('devices').update({ revoked_at: new Date().toISOString() }).eq('member_id', memberId).is('revoked_at', null);
    }
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function recordPaymentAction(input: {
  memberId: string;
  amount: number | string;
  method: PaymentMethod;
  paidOn: string;
  extend: boolean;
  planId?: string | null;
  note?: string;
}): Promise<ActionResult<{ paymentId: string; validTill: string | null }>> {
  try {
    const { supabase } = await requireGym();
    const parsed = paymentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error), fields: fieldErrors(parsed.error) };
    const d = parsed.data;
    const { data, error } = await supabase.rpc('record_payment', {
      p_member_id: d.memberId,
      p_amount: d.amount,
      p_method: d.method,
      p_paid_on: d.paidOn,
      p_extend: d.extend,
      p_plan_id: d.planId ?? null,
      p_note: d.note,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as { payment_id: string; new_valid_till: string | null };
    refresh();
    return { ok: true, paymentId: row.payment_id, validTill: row.new_valid_till };
  } catch (err) {
    return toError(err);
  }
}

export async function deletePaymentAction(paymentId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireGym();
    const { error } = await supabase.rpc('delete_latest_payment', { p_payment_id: paymentId });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// ---------------------------------------------------------------------------
// Phone access
// ---------------------------------------------------------------------------

export async function createActivationLinkAction(memberId: string): Promise<ActionResult<{ waUrl: string; link: string }>> {
  try {
    const { supabase, gym } = await requireGym();
    const { data: member } = await supabase.from('members').select('id, name, phone, archived_at').eq('id', memberId).maybeSingle();
    if (!member || member.archived_at) throw new UserError(m.member.notFound);
    return { ok: true, ...(await issueActivation(supabase, gym, member)) };
  } catch (err) {
    return toError(err);
  }
}

export async function resetDeviceAction(memberId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireGym();
    const now = new Date().toISOString();
    const { error } = await supabase.from('devices').update({ revoked_at: now }).eq('member_id', memberId).is('revoked_at', null);
    if (error) throw error;
    await supabase.from('device_requests').update({ status: 'declined', decided_at: now }).eq('member_id', memberId).eq('status', 'pending');
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function decideDeviceRequestAction(requestId: string, approve: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireGym();
    const { error } = await supabase.rpc('decide_device_request', { p_request_id: requestId, p_approve: approve });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

// ---------------------------------------------------------------------------
// Check-in from the owner's phone
// ---------------------------------------------------------------------------

export async function manualCheckinAction(memberId: string): Promise<ActionResult<{ repeat: boolean }>> {
  try {
    const { supabase, gym } = await requireGym();
    const { data: member } = await supabase.from('members').select('id, archived_at').eq('id', memberId).maybeSingle();
    if (!member) throw new UserError(m.member.notFound);
    if (member.archived_at) throw new UserError(m.member.archivedBanner);
    const result = await performCheckin(createAdminClient(), { gym, memberId, kioskId: null, method: 'manual' });
    refresh();
    return { ok: true, repeat: result.repeat };
  } catch (err) {
    return toError(err);
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function updateGymAction(input: { name: string; phone?: string }): Promise<ActionResult> {
  try {
    const { supabase, gym } = await requireGym();
    const parsed = gymSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { error } = await supabase
      .from('gyms')
      .update({ name: parsed.data.name, phone: parsed.data.phone || null })
      .eq('id', gym.id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function updateKioskSettingsAction(input: { qrIntervalSecs: number; resultSecs: number; keypadEnabled: boolean }): Promise<ActionResult> {
  try {
    const { supabase, gym } = await requireGym();
    const parsed = kioskSettingsSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { error } = await supabase
      .from('gyms')
      .update({ qr_interval_secs: parsed.data.qrIntervalSecs, result_secs: parsed.data.resultSecs, keypad_enabled: parsed.data.keypadEnabled })
      .eq('id', gym.id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function updateSecurityAction(input: { requirePasskey: boolean; oneDevicePerMember: boolean }): Promise<ActionResult> {
  try {
    const { supabase, gym } = await requireGym();
    const parsed = securitySchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { error } = await supabase
      .from('gyms')
      .update({ require_passkey: parsed.data.requirePasskey, one_device_per_member: parsed.data.oneDevicePerMember })
      .eq('id', gym.id);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function changePinAction(pin: string): Promise<ActionResult> {
  try {
    const { supabase, gym } = await requireGym();
    const parsed = pinSchema.safeParse(pin);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const { error } = await supabase
      .from('gyms')
      .update({ kiosk_pin_hash: await hashPin(parsed.data) })
      .eq('id', gym.id);
    if (error) throw error;
    await supabase.from('kiosks').update({ pin_failures: 0, locked_until: null }).eq('gym_id', gym.id);
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function savePlanAction(input: { id?: string; name: string; durationDays: number | string; price: number | string }): Promise<ActionResult> {
  try {
    const { supabase, gym } = await requireGym();
    const parsed = planSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: firstError(parsed.error) };
    const row = { name: parsed.data.name, duration_days: parsed.data.durationDays, price: parsed.data.price };
    const { error } = parsed.data.id
      ? await supabase.from('plans').update(row).eq('id', parsed.data.id)
      : await supabase.from('plans').insert({ ...row, gym_id: gym.id, sort: 100 });
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function setPlanActiveAction(planId: string, active: boolean): Promise<ActionResult> {
  try {
    const { supabase } = await requireGym();
    const { error } = await supabase.from('plans').update({ is_active: active }).eq('id', planId);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

/** Pairs the current browser as a kiosk tablet and opens kiosk mode. */
export async function startKioskAction(): Promise<void> {
  const { supabase, gym } = await requireGym();
  const store = await cookies();
  const existing = store.get(KIOSK_COOKIE)?.value;
  if (existing) {
    const { data } = await supabase.from('kiosks').select('id').eq('session_hash', sha256(existing)).is('revoked_at', null).maybeSingle();
    if (data) redirect('/kiosk');
  }
  const { count } = await supabase.from('kiosks').select('id', { count: 'exact', head: true });
  const secret = randomSecret();
  const { error } = await supabase.from('kiosks').insert({ gym_id: gym.id, name: `Kiosk ${(count ?? 0) + 1}`, session_hash: sha256(secret) });
  if (error) throw error;
  store.set(KIOSK_COOKIE, secret, secureCookie);
  redirect('/kiosk');
}

export async function removeKioskAction(kioskId: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireGym();
    const { error } = await supabase.from('kiosks').update({ revoked_at: new Date().toISOString(), session_hash: null }).eq('id', kioskId);
    if (error) throw error;
    refresh();
    return { ok: true };
  } catch (err) {
    return toError(err);
  }
}

export async function setThemeAction(theme: 'system' | 'light' | 'dark'): Promise<void> {
  const store = await cookies();
  if (theme === 'system') store.delete(THEME_COOKIE);
  else store.set(THEME_COOKIE, theme, { path: '/', maxAge: secureCookie.maxAge, sameSite: 'lax' });
  refresh();
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
