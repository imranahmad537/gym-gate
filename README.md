# GymGate

Check-ins and fee tracking for small neighbourhood gyms. It replaces the paper register with three parts:

- **Owner app** (phone, tablet or laptop): dashboard, members, payments, WhatsApp reminders, reports and settings.
- **Kiosk** (`/kiosk`, a tablet at the entrance): shows a QR code that changes every 15–30 seconds, plus a keypad for members without a smartphone.
- **Member pass** (`/m`): a member activates their phone once from a WhatsApp link. After that they scan the kiosk QR with their phone camera to check in.

Built with Next.js 16 (App Router, Server Actions), React 19, Tailwind CSS 4 and Supabase (Postgres, Auth, Storage, Realtime).

---

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com). Pick the **Mumbai (ap-south-1)** or **Singapore** region so check-ins are fast from Pakistan.
2. Apply the database schema in one of two ways:
   - **SQL editor:** paste and run each file in `supabase/migrations/`, oldest first (`20261015000000_init.sql`, then `20261015120000_record_checkin.sql`).
   - **CLI:** `supabase link --project-ref <ref>`, then `supabase db push`.

   The schema creates the tables, row-level security, the database functions and a private `member-photos` storage bucket.
3. **Authentication → URL configuration:** set **Site URL** to your app URL. Add `https://your-domain/auth/callback` to **Redirect URLs**.
4. **Realtime → Settings:** leave **"Allow public access"** on. The kiosk listens on a channel name only it knows. If Realtime is turned off, the kiosk falls back to checking every 4 seconds.

## 2. Configure and run

```bash
cp .env.example .env.local   # fill in the values from Supabase → Settings → API
npm install
npm run dev                  # http://localhost:3000
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public Supabase connection details |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Used by the kiosk and member-phone routes once they have proven which gym a request belongs to |
| `APP_URL` | Public URL, e.g. `https://gymgate.pk`. Used in activation links and for passkeys. Required in production |
| `APP_SECRET` | 32+ random characters. Signs the short-lived fingerprint check-in tickets |

To try it out, sign up and create your gym, then run `npm run seed:demo`. This adds 17 demo members with mixed fee status and a week of check-ins.

## 3. Deploy

The app runs on any Node 20+ host.

- **Vercel:** import the repo and set the env vars. Pick the function region nearest your Supabase project (`bom1` for Mumbai). Vercel's free Hobby plan is for non-commercial use only, so use Pro once gyms are paying.
- **VPS:** run `npm ci && npm run build && npm start` behind Nginx or Caddy with HTTPS. HTTPS is required: the kiosk uses Web Crypto and the phones use secure cookies and passkeys.

## 4. Daily use

1. **Pair the tablet.** On the gym tablet, sign in as the owner and open **Settings → Start kiosk on this device**. The tablet gets its own kiosk cookie and opens `/kiosk`. To leave kiosk mode, press and hold the gym logo for about a second, then enter the kiosk PIN. Leaving opens the owner app, which asks you to sign in.
2. **Add members.** Use **Add Member** to add someone. In the "Member added" sheet, tap **Send activation link on WhatsApp**, or skip if they will use the keypad.
3. **Activate the phone.** The member opens the link and taps **Activate this phone**. That phone is now their gym pass.
4. **Check in.** The member scans the tablet QR with their camera. Their phone shows a green tick and the tablet shows their photo and fee status. Members without a smartphone type the last 4 digits of their phone number on the keypad. If more than one member matches, the tablet shows photos to pick from.
5. **New phone.** If a member opens an old link on a new phone, they can tap **Ask to use this phone**. A **device request** then appears on your dashboard for you to approve.

## How check-in security works

- **The QR code** contains `/m/c?k=<kiosk>&w=<time window>&t=<HMAC(kiosk secret, kiosk.window)>`. The tablet generates it locally, so it keeps rotating even with no internet. The server accepts the current window plus one either side, and the kiosk syncs its clock with the server. A photo of the QR stops working within a minute.
- **The phone pass** is a random secret in an `httpOnly` cookie. Only its SHA-256 hash is stored. An activation link works once and expires after 7 days. With "One device per member" on, activating or approving a new phone switches off the old one.
- **Fingerprint step (optional):** turn on **Settings → Require fingerprint or face** to add a passkey (WebAuthn) check on the member's phone before each check-in.
- **Repeat scans:** a second scan within 3 hours shows "Already checked in" and is not counted again.
- **Separation between gyms:** every table is protected by row-level security per gym. Composite foreign keys stop rows from linking to another gym's members. Server code uses the service-role key only after a kiosk cookie, device cookie or activation code has identified the gym.
- **Kiosk PIN:** stored as an scrypt hash. Five wrong tries lock it for 5 minutes.

## Offline behaviour

- **QR and keypad:** the kiosk caches the member list. The QR keeps rotating and keypad check-ins work with no internet. They are queued on the tablet and synced when the connection returns; the status pill shows how many are waiting.
- **Phone scans** need the member's phone to be online. The kiosk shows the result once it reconnects.
- **Service worker** (`public/sw.js`): caches the app files, the kiosk page and member photos. Owner pages are never cached.

## Project layout

```
app/(auth)/        sign in, sign up, password reset, gym setup
app/(owner)/       dashboard, members, member detail, check-in, reports, settings + server actions
app/kiosk/         tablet kiosk (rotating QR, keypad, offline queue, PIN exit)
app/m/             member pass: activation, scan result, device switch
app/api/           check-in, kiosk sync/events/exit, device requests, CSV export
lib/               dates (Asia/Karachi), money (Rs), phone (+92), fee status, tokens, data access
messages/en.ts     every piece of on-screen text — add ur.ts for Urdu
supabase/          database migration
tests/             unit tests + database tests (real migration in an in-memory Postgres)
```

## Adding Urdu

1. Copy `messages/en.ts` to `messages/ur.ts` and export `ur: Messages` with `dir: 'rtl'`.
2. Register it in `messages/index.ts`.
3. Choose the language per gym or per user.

All text is already in those files, and the layouts use flex and grid, so they mirror correctly for right-to-left.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build, serve |
| `npm test` | Unit tests plus database tests: runs the migration, database functions and access rules in PGlite |
| `npm run lint` / `typecheck` / `format` | ESLint, TypeScript, Prettier |
| `npm run seed:demo` | Demo members for an existing gym |
