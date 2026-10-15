// Runs the real migration in an in-memory Postgres (PGlite) with a minimal
// stand-in for Supabase's auth schema and roles, then exercises the RPC
// functions and row level security as two different gym owners.
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { beforeAll, describe, expect, it } from 'vitest';

const OWNER_A = '11111111-1111-1111-1111-111111111111';
const OWNER_B = '22222222-2222-2222-2222-222222222222';

let db: PGlite;

async function as(owner: string | null, sql: string, params: unknown[] = []) {
  await db.exec('reset role');
  if (owner) {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [owner]);
    await db.exec('set role authenticated');
  }
  try {
    return await db.query<Record<string, unknown>>(sql, params);
  } finally {
    await db.exec('reset role');
  }
}

beforeAll(async () => {
  db = await PGlite.create({ extensions: { pgcrypto } });
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create schema extensions;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth, extensions to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated;
    alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
    insert into auth.users (id) values ('${OWNER_A}'), ('${OWNER_B}');
  `);
  const dir = path.join(__dirname, '../supabase/migrations');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(path.join(dir, file), 'utf8'));
  }
  await db.exec('grant usage on schema extensions to authenticated; grant execute on all functions in schema extensions to authenticated;');
}, 60_000);

describe('database', () => {
  let gymA: string;
  let memberA: string;
  let monthly: string;

  it('creates a gym with three starter plans', async () => {
    const r = await as(OWNER_A, `select public.create_gym('Khyber Fitness Club', '', 'scrypt$x$y') as id`);
    gymA = r.rows[0].id as string;
    const plans = await as(OWNER_A, `select name, duration_days, price from plans order by sort`);
    expect(plans.rows).toEqual([
      { name: 'Monthly', duration_days: 30, price: 2500 },
      { name: 'Quarterly', duration_days: 90, price: 6500 },
      { name: 'Yearly', duration_days: 365, price: 24000 },
    ]);
    monthly = (await as(OWNER_A, `select id from plans where name = 'Monthly'`)).rows[0].id as string;
    await expect(as(OWNER_A, `select public.create_gym('Again', '', null)`)).rejects.toThrow(/gym_exists/);
  });

  it('adds members with sequential IDs and a first payment', async () => {
    const r = await as(OWNER_A, `select * from public.create_member('Ali Khan', '+923001234567', $1, '2026-10-01', 2500, 'cash')`, [monthly]);
    const m = r.rows[0];
    memberA = m.id as string;
    expect(m.member_no).toBe(1001);
    expect(m.phone_last4).toBe('4567');
    expect(String((m.valid_till as Date).toISOString()).slice(0, 10)).toBe('2026-10-30');

    const r2 = await as(OWNER_A, `select * from public.create_member('Sana Malik', '+923221234567', $1, '2026-10-02')`, [monthly]);
    expect(r2.rows[0].member_no).toBe(1002);
    expect(r2.rows[0].valid_till).toBeNull();
  });

  it('rejects bad phone numbers', async () => {
    await expect(as(OWNER_A, `select * from public.create_member('Bad Phone', '03001234567', $1, '2026-10-02')`, [monthly])).rejects.toThrow();
  });

  it('extends from the end date while still active, and from the payment date when overdue', async () => {
    const early = await as(OWNER_A, `select new_valid_till::text as v from public.record_payment($1, 2500, 'jazzcash', '2026-10-25', true)`, [memberA]);
    expect(early.rows[0].v).toBe('2026-11-29');

    const late = await as(OWNER_A, `select new_valid_till::text as v from public.record_payment($1, 2500, 'cash', '2026-12-10', true)`, [memberA]);
    expect(late.rows[0].v).toBe('2027-01-08');

    const part = await as(OWNER_A, `select new_valid_till::text as v from public.record_payment($1, 1000, 'cash', '2026-12-11', false)`, [memberA]);
    expect(part.rows[0].v).toBe('2027-01-08');
  });

  it('only deletes the latest payment and rolls valid_till back', async () => {
    const pays = await as(OWNER_A, `select id, extends_plan from payments where member_id = $1 order by created_at desc, id desc`, [memberA]);
    const [latest, second] = pays.rows;
    await expect(as(OWNER_A, `select public.delete_latest_payment($1)`, [second.id])).rejects.toThrow(/not_latest_payment/);
    await as(OWNER_A, `select public.delete_latest_payment($1)`, [latest.id]); // part payment, no change
    const v1 = await as(OWNER_A, `select valid_till::text as v from members where id = $1`, [memberA]);
    expect(v1.rows[0].v).toBe('2027-01-08');
    await as(OWNER_A, `select public.delete_latest_payment($1)`, [second.id]);
    const v2 = await as(OWNER_A, `select valid_till::text as v from members where id = $1`, [memberA]);
    expect(v2.rows[0].v).toBe('2026-11-29');
  });

  it('keeps gyms apart', async () => {
    await as(OWNER_B, `select public.create_gym('Other Gym', '', null)`);
    const seen = await as(OWNER_B, `select count(*)::int as n from members`);
    expect(seen.rows[0].n).toBe(0);
    await expect(as(OWNER_B, `select * from public.record_payment($1, 2500, 'cash', '2026-10-10', true)`, [memberA])).rejects.toThrow(/member_not_found/);
    await expect(
      as(OWNER_B, `insert into payments (gym_id, member_id, amount, method, paid_on) values ($1, $2, 1, 'cash', '2026-10-10')`, [gymA, memberA]),
    ).rejects.toThrow();
    const bGym = (await as(OWNER_B, `select id from gyms`)).rows[0].id;
    // Even with its own gym_id, B cannot attach rows to A's member (composite FK).
    await expect(
      as(OWNER_B, `insert into payments (gym_id, member_id, amount, method, paid_on) values ($1, $2, 1, 'cash', '2026-10-10')`, [bGym, memberA]),
    ).rejects.toThrow();
    const anon = await db.query(`set role anon; select count(*)::int as n from members`).catch((e) => e);
    await db.exec('reset role');
    expect(anon).toBeInstanceOf(Error);
  });

  it('approving a phone request swaps the active device', async () => {
    await db.query(`insert into devices (gym_id, member_id, secret_hash, label) values ($1, $2, 'old', 'Samsung A54')`, [gymA, memberA]);
    const req = await db.query<{ id: string }>(
      `insert into device_requests (gym_id, member_id, secret_hash, label) values ($1, $2, 'new', 'Infinix Hot 40') returning id`,
      [gymA, memberA],
    );
    await as(OWNER_A, `select public.decide_device_request($1, true)`, [req.rows[0].id]);
    const devices = await db.query<{ secret_hash: string; revoked: boolean }>(
      `select secret_hash, revoked_at is not null as revoked from devices where member_id = $1 order by secret_hash`,
      [memberA],
    );
    expect(devices.rows).toEqual([
      { secret_hash: 'new', revoked: false },
      { secret_hash: 'old', revoked: true },
    ]);
    await expect(as(OWNER_A, `select public.decide_device_request($1, true)`, [req.rows[0].id])).rejects.toThrow(/request_not_found/);
  });

  it('aggregates visits, daily check-ins and payments per gym', async () => {
    await db.query(
      `insert into checkins (gym_id, member_id, method, fee_status, checked_at) values
        ($1, $2, 'keypad', 'active', '2026-10-09 20:30:00+00'),
        ($1, $2, 'phone', 'active', '2026-10-10 04:00:00+00')`,
      [gymA, memberA],
    );
    const visits = await as(OWNER_A, `select visits::int as v from public.visit_counts($1, '2026-10-01')`, [gymA]);
    expect(visits.rows[0].v).toBe(2);
    // 20:30 UTC on the 9th is 01:30 on the 10th in Karachi.
    const daily = await as(OWNER_A, `select day::text as d, checkins::int as n from public.daily_checkins($1, '2026-10-01', 'Asia/Karachi')`, [gymA]);
    expect(daily.rows).toEqual([{ d: '2026-10-10', n: 2 }]);
    const sum = await as(OWNER_A, `select method::text as method, total::int as total from public.payment_summary($1, '2026-10-01', '2026-10-31') order by 1`, [
      gymA,
    ]);
    expect(sum.rows).toEqual([
      { method: 'cash', total: 2500 },
      { method: 'jazzcash', total: 2500 },
    ]);
    const other = await as(OWNER_B, `select count(*)::int as n from public.visit_counts($1, '2026-10-01')`, [gymA]);
    expect(other.rows[0].n).toBe(0);
  });

  it('records a check-in once, then reports repeats within the window', async () => {
    const checkin = (at: string, clientId: string | null = null) =>
      db.query<{ checkin_id: string; is_repeat: boolean }>(
        `select checkin_id, is_repeat from public.record_checkin($1, $2, null, 'phone', 'active', $3, $4)`,
        [gymA, memberA, at, clientId],
      );
    const first = await checkin('2026-10-12 10:00:00+00');
    expect(first.rows[0].is_repeat).toBe(false);
    // A second scan moments later (double tap) returns the same row.
    const again = await checkin('2026-10-12 10:00:01+00');
    expect(again.rows[0]).toEqual({ checkin_id: first.rows[0].checkin_id, is_repeat: true });
    // After the 3-hour window it counts as a new visit.
    const later = await checkin('2026-10-12 13:00:01+00');
    expect(later.rows[0].is_repeat).toBe(false);
    expect(later.rows[0].checkin_id).not.toBe(first.rows[0].checkin_id);

    // An offline keypad item synced twice is returned as-is, not as a repeat.
    const clientId = '33333333-3333-3333-3333-333333333333';
    const synced = await checkin('2026-10-13 10:00:00+00', clientId);
    const resynced = await checkin('2026-10-13 10:00:00+00', clientId);
    expect(resynced.rows[0]).toEqual({ checkin_id: synced.rows[0].checkin_id, is_repeat: false });
    const n = await db.query<{ n: number }>(`select count(*)::int as n from checkins where member_id = $1 and checked_at >= '2026-10-12'`, [memberA]);
    expect(n.rows[0].n).toBe(3);
  });

  it('refuses check-ins for members of another gym, and is server-only', async () => {
    const gymB = (await as(OWNER_B, `select id from gyms`)).rows[0].id as string;
    await expect(db.query(`select * from public.record_checkin($1, $2, null, 'phone', 'active', now())`, [gymB, memberA])).rejects.toThrow(/member_not_found/);
    await expect(as(OWNER_A, `select * from public.record_checkin($1, $2, null, 'manual', 'active', now())`, [gymA, memberA])).rejects.toThrow(/permission denied/);
  });

  it('gives kiosks random secrets', async () => {
    const k = await as(OWNER_A, `insert into kiosks (gym_id, name) values ($1, 'Kiosk 1') returning secret, channel_key`, [gymA]);
    expect(String(k.rows[0].secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(String(k.rows[0].channel_key)).toMatch(/^[0-9a-f]{32}$/);
  });
});
