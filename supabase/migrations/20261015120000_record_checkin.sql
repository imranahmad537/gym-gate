-- Atomic check-in. Two scans that arrive at the same moment (a double tap,
-- or a phone and the keypad together) used to both see "no recent check-in"
-- and both insert. Locking the member row makes them run one after the other,
-- so the second one finds the first and reports a repeat.
create or replace function public.record_checkin(
  p_gym uuid,
  p_member uuid,
  p_kiosk uuid,
  p_method public.checkin_method,
  p_fee_status text,
  p_at timestamptz,
  p_client_id uuid default null,
  p_repeat_secs int default 10800
)
returns table (checkin_id uuid, checkin_at timestamptz, is_repeat boolean)
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_id uuid;
  v_at timestamptz;
begin
  perform 1 from public.members where id = p_member and gym_id = p_gym for update;
  if not found then
    raise exception 'member_not_found';
  end if;

  -- Same offline keypad item synced twice: return the original row.
  if p_client_id is not null then
    select c.id, c.checked_at into v_id, v_at from public.checkins c where c.client_id = p_client_id;
    if found then
      return query select v_id, v_at, false;
      return;
    end if;
  end if;

  select c.id, c.checked_at into v_id, v_at
  from public.checkins c
  where c.member_id = p_member
    and c.checked_at >= p_at - make_interval(secs => p_repeat_secs)
    and c.checked_at <= p_at + interval '1 minute'
  order by c.checked_at desc
  limit 1;
  if found then
    return query select v_id, v_at, true;
    return;
  end if;

  insert into public.checkins (gym_id, member_id, kiosk_id, method, fee_status, checked_at, client_id)
  values (p_gym, p_member, p_kiosk, p_method, p_fee_status, p_at, p_client_id)
  returning id, checked_at into v_id, v_at;
  return query select v_id, v_at, false;
end;
$$;

-- Server only: callers have already proven which gym the request belongs to.
revoke execute on function public.record_checkin(uuid, uuid, uuid, public.checkin_method, text, timestamptz, uuid, int) from public, anon, authenticated;
grant execute on function public.record_checkin(uuid, uuid, uuid, public.checkin_method, text, timestamptz, uuid, int) to service_role;
