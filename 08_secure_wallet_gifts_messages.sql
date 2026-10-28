-- LOVORA secure wallet, paid messages and gifts. Additive migration.
-- Run once in Supabase SQL Editor. No browser-side balance is trusted.

-- Seed existing accounts once with the same 500 welcome coins shown in the app.
with seeded as (
  insert into public.lovora_wallet_accounts(user_id,balance)
  select id,500 from auth.users
  on conflict(user_id) do nothing
  returning user_id
)
insert into public.lovora_coin_transactions(user_id,amount,transaction_type,description)
select user_id,500,'subscription_bonus','LOVORA welcome coins' from seeded;

-- Future accounts get a one-time welcome balance.
create or replace function public.lovora_create_wallet_for_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  insert into public.lovora_wallet_accounts(user_id,balance) values(new.id,500)
  on conflict(user_id) do nothing;
  if found then
    insert into public.lovora_coin_transactions(user_id,amount,transaction_type,description)
    values(new.id,500,'subscription_bonus','LOVORA welcome coins');
  end if;
  return new;
end $$;
drop trigger if exists lovora_new_user_wallet on auth.users;
create trigger lovora_new_user_wallet after insert on auth.users
for each row execute function public.lovora_create_wallet_for_new_user();

-- Match the visible gift catalogue and prices in index.html.
insert into public.lovora_gifts_catalog(slug,name,coin_cost,animation_key,enabled) values
 ('rose','Rose',100,'rose-bloom',true),
 ('heart','Heart',200,'heart-pulse',true),
 ('ice-cream','Ice Cream',300,'ice-cream',true),
 ('teddy-bear','Teddy Bear',500,'teddy-pop',true),
 ('crown','Crown',1000,'gold-shine',true),
 ('diamond','Diamond',2000,'diamond-sparkle',true),
 ('rocket','Rocket',10000,'rocket',true),
 ('super-gift','Super Gift',20000,'super-gift',true)
on conflict(slug) do update set name=excluded.name,coin_cost=excluded.coin_cost,animation_key=excluded.animation_key,enabled=true;

create or replace function public.lovora_get_wallet_balance()
returns bigint language plpgsql security definer set search_path=public
as $$
declare v_uid uuid:=auth.uid(); v_balance bigint;
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;
  insert into public.lovora_wallet_accounts(user_id,balance) values(v_uid,500) on conflict(user_id) do nothing;
  select balance into v_balance from public.lovora_wallet_accounts where user_id=v_uid;
  return coalesce(v_balance,0);
end $$;

-- Securely charge one coin per private text message. Rejects insufficient balances.
create or replace function public.lovora_send_paid_message(p_match_id uuid,p_body text)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_uid uuid:=auth.uid(); v_other uuid; v_body text:=btrim(coalesce(p_body,'')); v_message_id uuid; v_balance bigint;
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;
  if char_length(v_body)<1 or char_length(v_body)>4000 then raise exception 'Messages must contain 1–4000 characters.'; end if;
  select case when m.user1=v_uid then m.user2 else m.user1 end into v_other
  from public.matches m where m.id=p_match_id and (m.user1=v_uid or m.user2=v_uid);
  if v_other is null then raise exception 'This conversation is not available to your account.'; end if;
  if exists(select 1 from public.profiles p where p.id=v_uid and p.account_status is not null and p.account_status<>'active') then raise exception 'Your account is restricted.'; end if;
  if exists(select 1 from public.lovora_blocks b where (b.blocker_id=v_uid and b.blocked_id=v_other) or (b.blocker_id=v_other and b.blocked_id=v_uid)) then raise exception 'Messaging is unavailable because one account has blocked the other.'; end if;
  insert into public.lovora_wallet_accounts(user_id,balance) values(v_uid,500) on conflict(user_id) do nothing;
  update public.lovora_wallet_accounts set balance=balance-1,updated_at=now() where user_id=v_uid and balance>=1 returning balance into v_balance;
  if v_balance is null then raise exception 'You need at least 1 coin to send a message.'; end if;
  insert into public.lovora_coin_transactions(user_id,amount,transaction_type,description)
  values(v_uid,-1,'gift_sent','Private message charge');
  insert into public.messages(match_id,sender_id,content) values(p_match_id,v_uid,v_body) returning id into v_message_id;
  return v_message_id;
end $$;

-- Gift charges are atomic. Gift delivery appears in the private chat and generates a notification.
create or replace function public.lovora_send_gift(p_match_id uuid,p_gift_slug text,p_message text default '')
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_uid uuid:=auth.uid(); v_other uuid; v_gift public.lovora_gifts_catalog%rowtype; v_balance bigint; v_sent_id uuid; v_chat_text text;
begin
  if v_uid is null then raise exception 'Please sign in first.'; end if;
  select case when m.user1=v_uid then m.user2 else m.user1 end into v_other
  from public.matches m where m.id=p_match_id and (m.user1=v_uid or m.user2=v_uid);
  if v_other is null then raise exception 'Open a matched conversation before sending a gift.'; end if;
  if exists(select 1 from public.lovora_blocks b where (b.blocker_id=v_uid and b.blocked_id=v_other) or (b.blocker_id=v_other and b.blocked_id=v_uid)) then raise exception 'You cannot send a gift in this conversation.'; end if;
  select * into v_gift from public.lovora_gifts_catalog where slug=p_gift_slug and enabled=true;
  if v_gift.id is null then raise exception 'This gift is currently unavailable.'; end if;
  if char_length(coalesce(p_message,''))>300 then raise exception 'Gift note must be 300 characters or fewer.'; end if;
  insert into public.lovora_wallet_accounts(user_id,balance) values(v_uid,500) on conflict(user_id) do nothing;
  update public.lovora_wallet_accounts set balance=balance-v_gift.coin_cost,updated_at=now() where user_id=v_uid and balance>=v_gift.coin_cost returning balance into v_balance;
  if v_balance is null then raise exception 'Not enough coins. Your gift was not sent and no coins were charged.'; end if;
  insert into public.lovora_gifts_sent(sender_id,recipient_id,gift_id,message) values(v_uid,v_other,v_gift.id,btrim(coalesce(p_message,''))) returning id into v_sent_id;
  insert into public.lovora_coin_transactions(user_id,amount,transaction_type,reference_id,description)
  values(v_uid,-v_gift.coin_cost,'gift_sent',v_sent_id,'Sent gift: '||v_gift.name);
  v_chat_text:='[LOVORA_GIFT] 🎁 Sent a '||v_gift.name||' worth '||v_gift.coin_cost||' coins.';
  if char_length(btrim(coalesce(p_message,'')))>0 then v_chat_text:=v_chat_text||' Note: '||btrim(p_message); end if;
  insert into public.messages(match_id,sender_id,content) values(p_match_id,v_uid,v_chat_text);
  insert into public.lovora_notifications(user_id,kind,title,body)
  values(v_other,'gift','You received a gift', 'Someone sent you a '||v_gift.name||' worth '||v_gift.coin_cost||' coins.');
  return v_sent_id;
end $$;

grant execute on function public.lovora_get_wallet_balance() to authenticated;
grant execute on function public.lovora_send_paid_message(uuid,text) to authenticated;
grant execute on function public.lovora_send_gift(uuid,text,text) to authenticated;
