-- LOVORA live messaging + server-enforced coin deductions.
-- Run in Supabase SQL Editor after the existing LOVORA schema has been installed.
-- This migration does NOT activate paid subscriptions; premium_until must only be set
-- by a trusted server after a payment provider verifies a successful payment.

alter table public.profiles
  add column if not exists coin_balance integer not null default 500 check (coin_balance >= 0),
  add column if not exists premium_until timestamptz,
  add column if not exists account_status text not null default 'active'
    check (account_status in ('active','suspended','banned'));

-- Prevent browser clients from bypassing the coin RPC with direct message inserts.
drop policy if exists "Members send messages as themselves" on public.messages;

create or replace function public.send_lovora_message(p_match_id text, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_parts text[];
  v_other uuid;
  v_premium boolean := false;
  v_balance integer;
  v_message_id uuid;
  v_body text := btrim(coalesce(p_body, ''));
begin
  if v_uid is null then raise exception 'Sign in to send messages.'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'Messages must contain 1 to 2000 characters.';
  end if;
  if v_body ~* '(send[[:space:]]+nudes|show[[:space:]]+me[[:space:]]+your[[:space:]]+nude|explicit[[:space:]]+photo|dick[[:space:]]+pic|naked[[:space:]]+photo)' then
    raise exception 'This message was blocked by LOVORA safety rules.';
  end if;

  v_parts := string_to_array(p_match_id, '_');
  if array_length(v_parts, 1) <> 2 then raise exception 'Invalid match.'; end if;
  if v_parts[1]::uuid = v_uid then v_other := v_parts[2]::uuid;
  elsif v_parts[2]::uuid = v_uid then v_other := v_parts[1]::uuid;
  else raise exception 'You are not part of this match.'; end if;

  if not exists (
    select 1 from public.matches m
    where ((m.user_a = v_uid and m.user_b = v_other) or (m.user_b = v_uid and m.user_a = v_other))
  ) then raise exception 'You can only message a confirmed match.'; end if;

  if exists(select 1 from public.profiles p where p.id = v_uid and p.account_status <> 'active') then
    raise exception 'This account is currently restricted.';
  end if;
  if exists(select 1 from public.blocks b where (b.blocker_id = v_uid and b.blocked_id = v_other) or (b.blocker_id = v_other and b.blocked_id = v_uid)) then
    raise exception 'Messaging is unavailable for this pair.';
  end if;

  select (premium_until is not null and premium_until > now()), coin_balance
    into v_premium, v_balance
    from public.profiles where id = v_uid for update;
  if not found then raise exception 'Complete your profile before messaging.'; end if;
  if not v_premium then
    if v_balance < 1 then raise exception 'You are out of coins. Choose LOVORA Plus for unlimited messaging.'; end if;
    update public.profiles set coin_balance = coin_balance - 1 where id = v_uid returning coin_balance into v_balance;
  end if;

  insert into public.messages(match_id, sender_id, body)
    values (p_match_id, v_uid, v_body) returning id into v_message_id;
  return jsonb_build_object('message_id', v_message_id, 'coin_balance', v_balance, 'premium', v_premium);
end;
$$;

revoke all on function public.send_lovora_message(text, text) from public;
grant execute on function public.send_lovora_message(text, text) to authenticated;
