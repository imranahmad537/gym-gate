// Adds 17 demo members with mixed fee status, payments and a week of check-ins
// to an existing gym, so every screen looks real during a demo.
//   npm run seed:demo                 (uses the only gym in the database)
//   npm run seed:demo -- <gym-id>     (pick a gym)
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local.
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const fail = (msg) => { console.error(msg); process.exit(1); };

const { data: gyms, error } = await db.from('gyms').select('id, name, timezone, next_member_no');
if (error) fail(error.message);
const gym = process.argv[2] ? gyms.find((g) => g.id === process.argv[2]) : gyms.length === 1 ? gyms[0] : null;
if (!gym) fail(`Pass a gym id. Gyms: ${gyms.map((g) => `${g.id} (${g.name})`).join(', ') || 'none — sign up first'}`);

const { data: plans } = await db.from('plans').select('*').eq('gym_id', gym.id);
const plan = (name) => plans.find((p) => p.name === name) ?? plans[0];
const today = new Intl.DateTimeFormat('en-CA', { timeZone: gym.timezone }).format(new Date());
const day = (n) => { const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

// [name, phone, plan, valid till (days from today), visits this week]
const people = [
  ['Usman Tariq', '3124455667', 'Quarterly', 56, 5],
  ['Bilal Ahmed', '3339081726', 'Monthly', 3, 4],
  ['Hamza Yousaf', '3456677881', 'Monthly', -12, 3],
  ['Zeeshan Afridi', '3012233445', 'Yearly', 155, 5],
  ['Ayesha Siddiqui', '3217788990', 'Monthly', 12, 4],
  ['Fahad Iqbal', '3151122334', 'Monthly', -5, 2],
  ['Saad Mehmood', '3365544332', 'Quarterly', 2, 4],
  ['Imtiaz Khattak', '3028899001', 'Monthly', -20, 1],
  ['Nadia Rehman', '3312468024', 'Monthly', 18, 5],
  ['Waqas Shah', '3461357913', 'Quarterly', -3, 2],
  ['Junaid Akhtar', '3119753197', 'Monthly', 5, 3],
  ['Sana Malik', '3223141592', 'Yearly', 235, 6],
  ['Kamran Yousafzai', '3042718281', 'Monthly', 15, 3],
  ['Shahid Afzal', '3431618033', 'Monthly', -31, 0],
  ['Faisal Nawaz', '3351414213', 'Monthly', 9, 4],
  ['Asad Ullah', '3131732050', 'Monthly', 1, 5],
  ['Rizwan Gul', '3002234567', 'Quarterly', 51, 3],
];

let no = gym.next_member_no;
const methods = ['cash', 'cash', 'jazzcash', 'easypaisa', 'cash', 'bank'];
for (const [i, [name, phone, planName, tillOffset, visits]] of people.entries()) {
  const p = plan(planName);
  const validTill = day(tillOffset);
  const start = day(tillOffset - p.duration_days + 1);
  const { data: member, error: e1 } = await db
    .from('members')
    .insert({ gym_id: gym.id, member_no: no++, name, phone: `+92${phone}`, plan_id: p.id, valid_till: validTill, joined_on: day(-120 - i * 7) })
    .select('id')
    .single();
  if (e1) fail(`${name}: ${e1.message}`);
  await db.from('payments').insert({
    gym_id: gym.id, member_id: member.id, plan_id: p.id, amount: p.price, method: methods[i % methods.length],
    paid_on: start <= today ? start : today, extends_plan: true, period_start: start, period_end: validTill,
  });
  const rows = [];
  for (let v = 0; v < visits; v++) {
    const at = new Date(`${day(-v - (i % 2))}T${String(6 + ((i * 3 + v) % 14)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00+05:00`);
    if (at > new Date()) continue;
    rows.push({ gym_id: gym.id, member_id: member.id, method: v % 3 === 0 ? 'keypad' : 'phone', fee_status: tillOffset < 0 ? 'overdue' : tillOffset <= 5 ? 'due' : 'active', checked_at: at.toISOString() });
  }
  if (rows.length) await db.from('checkins').insert(rows);
}
await db.from('gyms').update({ next_member_no: no }).eq('id', gym.id);
console.log(`Added ${people.length} demo members to ${gym.name}.`);
