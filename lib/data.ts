import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { todayInTz } from '@/lib/dates';
import { feeInfo, type FeeInfo } from '@/lib/status';
import type { Gym, Member, Plan } from '@/lib/types';

export const PHOTO_BUCKET = 'member-photos';

/** Signed-in owner and their gym (null when signed out). Cached per request. */
export const getOwner = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: gym } = await supabase.from('gyms').select('*').maybeSingle();
  return { supabase, user, gym: (gym as Gym | null) ?? null };
});

/** For owner pages and actions: redirects to login / setup when needed. */
export const requireGym = cache(async () => {
  const owner = await getOwner();
  if (!owner) redirect('/login');
  if (!owner.gym) redirect('/setup');
  return { ...owner, gym: owner.gym, today: todayInTz(owner.gym.timezone) };
});

export const getPlans = cache(async (): Promise<Plan[]> => {
  const { supabase } = await requireGym();
  const { data, error } = await supabase.from('plans').select('*').order('sort').order('created_at');
  if (error) throw error;
  return (data ?? []) as Plan[];
});

export type MemberView = Member & { plan: Plan | null; fee: FeeInfo; photoUrl: string | null };

export const getMembers = cache(async (opts: { archived?: boolean } = {}): Promise<MemberView[]> => {
  const { supabase, today } = await requireGym();
  let q = supabase.from('members').select('*').order('name');
  q = opts.archived ? q.not('archived_at', 'is', null) : q.is('archived_at', null);
  const { data, error } = await q;
  if (error) throw error;
  const members = (data ?? []) as Member[];
  const plans = new Map((await getPlans()).map((p) => [p.id, p]));
  const photos = await signPhotos(members.map((x) => x.photo_path));
  return members.map((x) => ({
    ...x,
    plan: x.plan_id ? (plans.get(x.plan_id) ?? null) : null,
    fee: feeInfo(x.valid_till, today),
    photoUrl: x.photo_path ? (photos.get(x.photo_path) ?? null) : null,
  }));
});

/** Short-lived signed URLs for private member photos. */
export async function signPhotos(paths: (string | null | undefined)[], expiresIn = 60 * 60): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))];
  const out = new Map<string, string>();
  if (unique.length === 0) return out;
  const admin = createAdminClient();
  for (let i = 0; i < unique.length; i += 100) {
    const chunk = unique.slice(i, i + 100);
    const { data } = await admin.storage.from(PHOTO_BUCKET).createSignedUrls(chunk, expiresIn);
    for (const row of data ?? []) {
      if (row.path && row.signedUrl) out.set(row.path, row.signedUrl);
    }
  }
  return out;
}

export async function signPhoto(path: string | null | undefined, expiresIn = 60 * 60): Promise<string | null> {
  if (!path) return null;
  return (await signPhotos([path], expiresIn)).get(path) ?? null;
}
