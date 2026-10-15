-- GymGate initial schema
-- Run with the Supabase CLI (`supabase db push`) or paste into the SQL editor.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.payment_method as enum ('cash', 'jazzcash', 'easypaisa', 'bank');
create type public.checkin_method as enum ('phone', 'keypad', 'manual');
create type public.request_status as enum ('pending', 'approved', 'declined');

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.gyms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  phone text,
  timezone text not null default 'Asia/Karachi',
  qr_interval_secs int not null default 20 check (qr_interval_secs in (15, 20, 30)),
  result_secs int not null default 4 check (result_secs between 2 and 10),
  keypad_enabled boolean not null default true,
  require_passkey boolean not null default false,
  one_device_per_member boolean not null default true,
  kiosk_pin_hash text,
  next_member_no int not null default 1001,
  created_at timestamptz not null default now()
);

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  duration_days int not null check (duration_days between 1 and 3660),
  price int not null check (price between 0 and 10000000),
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (gym_id, id)
);

create table public.members (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_no int not null,
  name text not null check (char_length(name) between 2 and 80),
  phone text not null check (phone ~ '^\+923[0-9]{9}$'),
  phone_last4 text generated always as (right(phone, 4)) stored,
  photo_path text,
  plan_id uuid,
  valid_till date,
  joined_on date not null default current_date,
  note text check (char_length(note) <= 500),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  unique (gym_id, member_no),
  unique (gym_id, id),
  foreign key (gym_id, plan_id) references public.plans (gym_id, id)
);
create index members_gym_last4_idx on public.members (gym_id, phone_last4) where archived_at is null;

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null,
  plan_id uuid,
  amount int not null check (amount between 0 and 10000000),
  method public.payment_method not null,
  paid_on date not null,
  extends_plan boolean not null default true,
  period_start date,
  period_end date,
  note text check (char_length(note) <= 300),
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  foreign key (gym_id, member_id) references public.members (gym_id, id) on delete cascade,
  foreign key (gym_id, plan_id) references public.plans (gym_id, id)
);
create index payments_gym_paid_on_idx on public.payments (gym_id, paid_on desc);
create index payments_member_idx on public.payments (member_id, created_at desc);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null,
  secret_hash text not null unique,
  label text,
  activated_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_seen_at timestamptz,
  foreign key (gym_id, member_id) references public.members (gym_id, id) on delete cascade
);
create index devices_member_idx on public.devices (member_id) where revoked_at is null;

create table public.activations (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null,
  code_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_device_id uuid references public.devices (id) on delete set null,
  foreign key (gym_id, member_id) references public.members (gym_id, id) on delete cascade
);

create table public.device_requests (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null,
  secret_hash text not null,
  label text,
  status public.request_status not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  foreign key (gym_id, member_id) references public.members (gym_id, id) on delete cascade
);
create unique index device_requests_one_pending_idx on public.device_requests (member_id) where status = 'pending';

create table public.kiosks (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  secret text not null default encode(extensions.gen_random_bytes(32), 'hex'),
  channel_key text not null default encode(extensions.gen_random_bytes(16), 'hex'),
  session_hash text unique,
  pin_failures int not null default 0,
  locked_until timestamptz,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  unique (gym_id, id)
);

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  gym_id uuid not null references public.gyms (id) on delete cascade,
  member_id uuid not null,
  kiosk_id uuid references public.kiosks (id) on delete set null,
  method public.checkin_method not null,
  fee_status text not null check (fee_status in ('active', 'due', 'overdue', 'none')),
  checked_at timestamptz not null default now(),
  client_id uuid unique,
  foreign key (gym_id, member_id) references public.members (gym_id, id) on delete cascade
);
create index checkins_gym_time_idx on public.checkins (gym_id, checked_at desc);
create index checkins_member_time_idx on public.checkins (member_id, checked_at desc);
create index checkins_kiosk_time_idx on public.checkins (kiosk_id, checked_at desc);

create table public.passkeys (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices (id) on delete cascade,
  credential_id text not null unique,
  public_key text not null,
  counter bigint not null default 0,
  transports text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------
create or replace function public.current_gym_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.gyms where owner_id = auth.uid()
$$;

alter table public.gyms enable row level security;
alter table public.plans enable row level security;
alter table public.members enable row level security;
alter table public.payments enable row level security;
alter table public.devices enable row level security;
alter table public.activations enable row level security;
alter table public.device_requests enable row level security;
alter table public.kiosks enable row level security;
alter table public.checkins enable row level security;
alter table public.passkeys enable row level security; -- server (service role) only

create policy gyms_owner_select on public.gyms for select to authenticated using (owner_id = auth.uid());
create policy gyms_owner_insert on public.gyms for insert to authenticated with check (owner_id = auth.uid());
create policy gyms_owner_update on public.gyms for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy plans_owner on public.plans for all to authenticated
  using (gym_id = public.current_gym_id()) with check (gym_id = public.current_gym_id());
create policy members_owner on public.members for all to authenticated
  using (gym_id = public.current_gym_id()) with check (gym_id = public.current_gym_id());
create policy payments_owner on public.payments for all to authenticated
  using (gym_id = public.current_gym_id()) with check (gym_id = public.current_gym_id());
create policy devices_owner on public.devices for all to authenticated
  using (gym_id = public.current_gym_id()) with check (gym_id = public.current_gym_id());
create policy activations_owner on public.activations for all to authenticated
  using (gym_id = public.current_gym_id()) with check (gym_id = public.current_gym_id());
create policy device_requests_owner on public.device_requests for all to authenticated
  using (gym_id = public.current_gym_id()) with check (gym_id = public.current_gym_id());
create policy kiosks_owner on public.kiosks for all to authenticated
  using (gym_id = public.current_gym_id()) with check (gym_id = public.current_gym_id());
create policy checkins_owner on public.checkins for all to authenticated
  using (gym_id = public.current_gym_id()) with check (gym_id = public.current_gym_id());

revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- Functions (run as the calling owner, so RLS still applies)
-- ---------------------------------------------------------------------------

-- Creates the owner's gym with three starter plans.
create or replace function public.create_gym(p_name text, p_phone text, p_pin_hash text)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_gym uuid;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  if exists (select 1 from public.gyms where owner_id = auth.uid()) then
    raise exception 'gym_exists';
  end if;

  insert into public.gyms (owner_id, name, phone, kiosk_pin_hash)
  values (auth.uid(), trim(p_name), nullif(trim(p_phone), ''), p_pin_hash)
  returning id into v_gym;

  insert into public.plans (gym_id, name, duration_days, price, sort) values
    (v_gym, 'Monthly', 30, 2500, 1),
    (v_gym, 'Quarterly', 90, 6500, 2),
    (v_gym, 'Yearly', 365, 24000, 3);

  return v_gym;
end;
$$;

-- Records a payment and, when it extends the plan, moves valid_till forward
-- in the same transaction.
create or replace function public.record_payment(
  p_member_id uuid,
  p_amount int,
  p_method public.payment_method,
  p_paid_on date,
  p_extend boolean,
  p_plan_id uuid default null,
  p_note text default null,
  p_period_start date default null
)
returns table (payment_id uuid, new_valid_till date)
language plpgsql
security invoker
set search_path = public
as $$
declare
  m public.members%rowtype;
  pl public.plans%rowtype;
  v_plan uuid;
  v_start date;
  v_end date;
  v_id uuid;
begin
  select * into m from public.members where id = p_member_id for update;
  if not found then
    raise exception 'member_not_found';
  end if;

  v_plan := coalesce(p_plan_id, m.plan_id);

  if p_extend then
    select * into pl from public.plans where id = v_plan and gym_id = m.gym_id;
    if not found then
      raise exception 'plan_required';
    end if;
    v_start := coalesce(
      p_period_start,
      case when m.valid_till is not null and m.valid_till >= p_paid_on then m.valid_till + 1 else p_paid_on end
    );
    v_end := v_start + pl.duration_days - 1;
    update public.members set valid_till = v_end, plan_id = v_plan where id = m.id;
  end if;

  insert into public.payments (gym_id, member_id, plan_id, amount, method, paid_on, extends_plan, period_start, period_end, note)
  values (m.gym_id, m.id, v_plan, p_amount, p_method, p_paid_on, p_extend, v_start, v_end, nullif(trim(p_note), ''))
  returning id into v_id;

  return query select v_id, coalesce(v_end, m.valid_till);
end;
$$;

-- Deletes the member's most recent payment (undo / correct a mistake) and
-- rolls valid_till back to what the earlier payments cover.
create or replace function public.delete_latest_payment(p_payment_id uuid)
returns date
language plpgsql
security invoker
set search_path = public
as $$
declare
  p public.payments%rowtype;
  v_latest uuid;
  v_prev date;
begin
  select * into p from public.payments where id = p_payment_id;
  if not found then
    raise exception 'payment_not_found';
  end if;

  perform 1 from public.members where id = p.member_id for update;

  select id into v_latest from public.payments
  where member_id = p.member_id order by created_at desc, id desc limit 1;
  if v_latest <> p.id then
    raise exception 'not_latest_payment';
  end if;

  delete from public.payments where id = p.id;

  if p.extends_plan then
    select max(period_end) into v_prev from public.payments
    where member_id = p.member_id and extends_plan;
    update public.members set valid_till = v_prev where id = p.member_id;
  end if;

  return (select valid_till from public.members where id = p.member_id);
end;
$$;

-- Adds a member with the next member number and an optional first payment.
create or replace function public.create_member(
  p_name text,
  p_phone text,
  p_plan_id uuid,
  p_start date,
  p_amount int default null,
  p_method public.payment_method default 'cash',
  p_note text default null,
  p_photo_path text default null
)
returns public.members
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_gym uuid := public.current_gym_id();
  v_no int;
  m public.members%rowtype;
begin
  if v_gym is null then
    raise exception 'no_gym';
  end if;

  update public.gyms set next_member_no = next_member_no + 1
  where id = v_gym
  returning next_member_no - 1 into v_no;

  insert into public.members (gym_id, member_no, name, phone, plan_id, joined_on, note, photo_path)
  values (v_gym, v_no, trim(p_name), p_phone, p_plan_id, p_start, nullif(trim(p_note), ''), p_photo_path)
  returning * into m;

  if p_amount is not null then
    perform public.record_payment(m.id, p_amount, p_method, p_start, true, p_plan_id, null, p_start);
    select * into m from public.members where id = m.id;
  end if;

  return m;
end;
$$;

-- Approves a pending phone request: the new phone becomes the member's pass.
create or replace function public.decide_device_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  r public.device_requests%rowtype;
  v_one boolean;
begin
  select * into r from public.device_requests where id = p_request_id and status = 'pending' for update;
  if not found then
    raise exception 'request_not_found';
  end if;

  update public.device_requests
  set status = case when p_approve then 'approved'::public.request_status else 'declined'::public.request_status end,
      decided_at = now()
  where id = r.id;

  if not p_approve then
    return;
  end if;

  select one_device_per_member into v_one from public.gyms where id = r.gym_id;
  if v_one then
    update public.devices set revoked_at = now()
    where member_id = r.member_id and revoked_at is null and secret_hash <> r.secret_hash;
  end if;

  insert into public.devices (gym_id, member_id, secret_hash, label)
  values (r.gym_id, r.member_id, r.secret_hash, r.label)
  on conflict (secret_hash) do update
    set revoked_at = null, member_id = excluded.member_id, label = excluded.label, activated_at = now()
    where public.devices.gym_id = excluded.gym_id;
end;
$$;

revoke execute on function public.create_gym(text, text, text) from public, anon;
revoke execute on function public.record_payment(uuid, int, public.payment_method, date, boolean, uuid, text, date) from public, anon;
revoke execute on function public.delete_latest_payment(uuid) from public, anon;
revoke execute on function public.create_member(text, text, uuid, date, int, public.payment_method, text, text) from public, anon;
revoke execute on function public.decide_device_request(uuid, boolean) from public, anon;
revoke execute on function public.current_gym_id() from public, anon;
grant execute on function public.create_gym(text, text, text) to authenticated;
grant execute on function public.record_payment(uuid, int, public.payment_method, date, boolean, uuid, text, date) to authenticated;
grant execute on function public.delete_latest_payment(uuid) to authenticated;
grant execute on function public.create_member(text, text, uuid, date, int, public.payment_method, text, text) to authenticated;
grant execute on function public.decide_device_request(uuid, boolean) to authenticated;
grant execute on function public.current_gym_id() to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private bucket for member photos, one folder per gym
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('member-photos', 'member-photos', false, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do nothing;

    execute $p$
      create policy member_photos_owner on storage.objects for all to authenticated
      using (bucket_id = 'member-photos' and (storage.foldername(name))[1] = public.current_gym_id()::text)
      with check (bucket_id = 'member-photos' and (storage.foldername(name))[1] = public.current_gym_id()::text)
    $p$;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Aggregates (avoid pulling thousands of rows through the API)
-- ---------------------------------------------------------------------------
create or replace function public.visit_counts(p_gym uuid, p_since timestamptz)
returns table (member_id uuid, visits bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select c.member_id, count(*)::bigint
  from public.checkins c
  where c.gym_id = p_gym and c.checked_at >= p_since
  group by c.member_id
$$;

create or replace function public.daily_checkins(p_gym uuid, p_since timestamptz, p_tz text)
returns table (day date, checkins bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select (c.checked_at at time zone p_tz)::date as day, count(*)::bigint
  from public.checkins c
  where c.gym_id = p_gym and c.checked_at >= p_since
  group by 1
  order by 1
$$;

create or replace function public.payment_summary(p_gym uuid, p_from date, p_to date)
returns table (method public.payment_method, total bigint, payments bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select p.method, sum(p.amount)::bigint, count(*)::bigint
  from public.payments p
  where p.gym_id = p_gym and p.paid_on between p_from and p_to
  group by p.method
$$;

revoke execute on function public.visit_counts(uuid, timestamptz) from public, anon;
revoke execute on function public.daily_checkins(uuid, timestamptz, text) from public, anon;
revoke execute on function public.payment_summary(uuid, date, date) from public, anon;
grant execute on function public.visit_counts(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.daily_checkins(uuid, timestamptz, text) to authenticated, service_role;
grant execute on function public.payment_summary(uuid, date, date) to authenticated, service_role;
